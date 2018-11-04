import {Incrementer} from './incrementer';

interface DanglingImport {
  sourceNamespace: string;
  importNamespace: string;
  type: string;
  name: string;
}

export class Renamer {
  public childNamespaces: Renamer[] = [];
  public namingMaps: Map<string, Map<string, string>> = new Map();
  public ownNamingMaps: Map<string, Map<string, string>> = new Map();
  private childNamespaceMap: Map<string, Renamer> = new Map();
  private incrementers: Map<string, Incrementer> = new Map();
  private imports: Map<string, Map<string, Renamer>> = new Map();

  constructor(
    readonly incrementerType: {new (): Incrementer},
    readonly types: string[],
    readonly namespaces: string[] = ['root'],
    readonly parent?: Renamer
  ) {
    for (const type of types) {
      this.namingMaps.set(type, new Map());
      this.ownNamingMaps.set(type, new Map());
      this.incrementers.set(type, new incrementerType());
    }
  }

  get fullNamespace(): string {
    return this.namespaces.join('/');
  }

  /**
   * Creates a namespace specified by a single string, or returns the one if it already
   * exists.
   * @param name The namespace or its parts.
   */
  namespace(name: string | string[]): Renamer {
    if (Array.isArray(name)) {
      if (name.length == 0) return this;
      return this.namespace(name[0]).namespace(name.slice(1));
    }

    if (name == '..') {
      const parent = this.parent;
      if (parent == null) throw new Error('Cannot backtrack from root');
      return parent;
    }

    if (name == '/') {
      return this.getRoot();
    }

    if (this.childNamespaceMap.has(name)) {
      return this.childNamespaceMap.get(name) as Renamer;
    }

    const renamer = new Renamer(
      this.incrementerType,
      this.types,
      this.namespaces.concat([name]),
      this
    );
    this.childNamespaces.push(renamer);
    this.childNamespaceMap.set(name, renamer);
    return renamer;
  }

  static pathSpecToParts(spec: string): string[] {
    let parts = [];
    if (spec.startsWith('/')) {
      parts.push('/');
      spec = spec.substr(1);
    }
    if (spec.length > 0) {
      parts = parts.concat(spec.split('/'));
    }
    return parts;
  }

  getRoot(): Renamer {
    if (this.parent) return this.parent.getRoot();
    return this;
  }

  increment(type: string, value: string, originalCaller: Renamer = this): string {
    if (this.parent != null) return this.parent.increment(type, value, originalCaller);
    const incrementer = this.incrementers.get(type);
    if (incrementer == null) throw new Error('Invalid type');
    return incrementer.next(value, originalCaller);
  }

  addName(type: string, value: string, originalCaller: Renamer = this): string {
    const typeMap = this.namingMaps.get(type);
    const ownTypeMap = this.ownNamingMaps.get(type);
    const importMap = this.imports.get(type);
    const incrementer = this.incrementers.get(type);
    if (typeMap == null || incrementer == null) throw new Error('Invalid type');

    if (importMap != null) {
      if (importMap.has(value)) {
        const name = (importMap.get(value) as Renamer).addName(type, value, this);
        if (originalCaller == this) {
          // Add to own type map if applicable.
          (ownTypeMap as Map<string, string>).set(value, name);
        }
        return name;
      }
    }

    if (typeMap.has(value)) {
      // Return early if the name is found.
      const name = typeMap.get(value) as string;
      if (originalCaller == this) {
        // Add to own type map if applicable.
        (ownTypeMap as Map<string, string>).set(value, name);
      }
      return name;
    }

    const name = this.increment(type, value, originalCaller);
    typeMap.set(value, name);
    if (originalCaller == this) {
      // Add to own type map if applicable.
      (ownTypeMap as Map<string, string>).set(value, name);
    }
    return name;
  }

  setImport(type: string, name: string, renamer: Renamer) {
    let importMap: Map<string, Renamer>;
    if (this.imports.has(type)) {
      importMap = this.imports.get(type) as Map<string, Renamer>;
    } else {
      importMap = new Map();
      this.imports.set(type, importMap);
    }

    importMap.set(name, renamer);
  }

  import(namespaceSpec: string, type: string, name: string) {
    const parts = Renamer.pathSpecToParts(namespaceSpec);
    const namespace = this.namespace(parts);

    this.setImport(type, name, namespace);
  }

  reserve(type: string, name: string) {
    if (this.parent != null) this.parent.reserve(type, name);
    const incrementer = this.incrementers.get(type);
    if (incrementer == null) throw new Error(`Cannot reserve: invalid type ${type}`);
    incrementer.reserve(name);
  }

  danglingImports(): DanglingImport[] {
    let danglers = [];

    for (const [type, importMap] of this.imports.entries()) {
      // Go through each type-to-import entry.
      for (const [name, renamer] of importMap.entries()) {
        // Grab the import renamer instance, and use that to extract the typemap.
        const typeMap = renamer.ownNamingMaps.get(type);

        if (typeMap == null || !typeMap.has(name)) {
          // The import is unused.
          danglers.push({
            sourceNamespace: this.fullNamespace,
            importNamespace: renamer.fullNamespace,
            type,
            name,
          });
        }
      }
    }

    // Recurse
    for (const child of this.childNamespaces) {
      danglers = danglers.concat(child.danglingImports());
    }
    return danglers;
  }
}
