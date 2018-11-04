/**
 * Parse files with contents like this:
 *
 *   namespace: component
 *
 *   from .. import
 *     css
 *       dog
 *       cat
 *       bark
 *     id
 *       yes
 *
 *   from /slider import
 *     css
 *       slider
 */

interface Contents {
  contents?: string;
  length: number;
  allMatches?: string[];
  eof?: boolean;
  match?: boolean;
  flag?: string;
}

interface IndentedVar {
  value: string;
  whitespace: string;
}

export interface Namespec {
  namespace: string;
  imports: Map<string, Map<string, string[]>>;
  reserves: Map<string, Set<string>>;
}

export class NamespecParser {
  constructor(protected specContents: string) {}

  protected getLine(): Contents {
    if (this.specContents.length == 0) return {eof: true, length: 0};
    const position = this.specContents.indexOf('\n');
    if (position == -1) {
      return {contents: this.specContents, length: this.specContents.length};
    }
    return {contents: this.specContents.substr(0, position), length: position + 1};
  }

  protected eof(): boolean {
    return this.specContents.length == 0;
  }

  protected advance(n: number) {
    this.specContents = this.specContents.substr(n);
  }

  protected consumeWhitespaceWhileExists() {
    while (true) {
      const line = this.getLine();
      if (line.contents == null) return;
      if (line.contents.match(/^\s*$/)) {
        this.advance(line.length);
      } else {
        break;
      }
    }
  }

  protected consumeLine(spec: RegExp, flag?: string): Contents {
    this.consumeWhitespaceWhileExists();
    const line = this.getLine();
    const length = line.length;

    // If at the end of file, return accordingly.
    if (line.eof != null) return {eof: true, length};

    const contents = line.contents as string;
    // Try to match the line.
    const match = contents.match(spec);

    // Return early if there is no match.
    if (match == null) return {match: false, length};

    // Return matching group one otherwise.
    this.advance(length);
    const result: Contents = {contents: match[1], allMatches: match, length};
    if (flag != null) result.flag = flag;
    return result;
  }

  protected consumeNamespace(): string {
    const namespace = this.consumeLine(/^namespace (.+)$/);
    if (namespace.contents == null) {
      throw new Error('Expected to consume namespace');
    }
    return namespace.contents;
  }

  protected consumeImportOrReserve(): Contents {
    let result = this.consumeLine(/^from ([^ ]+) import$/, 'import');
    if (result.contents == null) {
      result = this.consumeLine(/^(reserve)$/, 'reserve');
    }
    return result;
  }

  protected consumeIndented(
    expectedWhitespace: string | RegExp | null
  ): IndentedVar | null {
    let type;
    if (expectedWhitespace == null) {
      type = this.consumeLine(/^([ \t]+)([a-zA-Z0-9_-]+)$/);
    } else {
      type = this.consumeLine(new RegExp(`^(${expectedWhitespace})([a-zA-Z0-9_-]+)$`));
    }
    if (type.allMatches == null) return null;
    return {
      value: type.allMatches[2],
      whitespace: type.allMatches[1],
    };
  }

  parse(): Namespec {
    const namespace = this.consumeNamespace();

    let expectedTypeWhitespace = null;
    let expectedNameWhitespace = null;

    const imports = new Map();
    const reserves = new Map();

    const result: Namespec = {namespace, imports, reserves};

    while (true) {
      // Iterate through remaining file consuming import statements.
      const entryResult = this.consumeImportOrReserve();
      if (entryResult.contents == null) {
        // If at end-of-file, successful parse!
        this.consumeWhitespaceWhileExists();
        if (this.eof()) return result;

        // Throw consume error otherwise.
        throw new Error(
          `Unexpected contents: ${this.specContents.substr(0, 15)}${
            this.specContents.length > 15 ? '...' : ''
          }`
        );
      }

      let importMap: Map<string, string[]> | null = null;
      let reservedMap: Map<string, Set<string>> | null = null;
      if (entryResult.flag == 'import') {
        const importNamespace = entryResult.contents;
        if (!result.imports.has(importNamespace)) {
          // Create the import map.
          importMap = new Map();
          result.imports.set(importNamespace, importMap);
        } else {
          importMap = result.imports.get(importNamespace) as Map<string, string[]>;
        }
      } else if (entryResult.flag != 'reserve') {
        throw new Error(`Unexpected flag: ${entryResult.flag}`);
      }

      while (true) {
        // Iterate through import consuming top-level types.
        const type = this.consumeIndented(expectedTypeWhitespace);
        if (type == null) break;

        const typeValue = type.value;
        expectedTypeWhitespace = type.whitespace;
        while (true) {
          // Iterate through type consuming secondary-level names.
          let name;
          if (expectedNameWhitespace == null) {
            // If name indent level is unknown, search for more indented than type.
            name = this.consumeIndented(expectedTypeWhitespace + '[ \t]+');
          } else {
            name = this.consumeIndented(expectedNameWhitespace);
          }
          if (name == null) break;

          const nameValue = name.value;
          expectedNameWhitespace = name.whitespace;

          // Add in the type, name pair.
          if (importMap != null) {
            // Add import
            if (importMap.has(typeValue)) {
              const nameEntries = importMap.get(typeValue) as string[];
              nameEntries.push(nameValue);
            } else {
              importMap.set(typeValue, [nameValue]);
            }
          } else if (reserves != null) {
            // Add reserved.
            if (reserves.has(typeValue)) {
              const reservedSet = reserves.get(typeValue) as Set<string>;
              reservedSet.add(nameValue);
            } else {
              reserves.set(typeValue, new Set([nameValue]));
            }
          } else {
            throw new Error('Expected import or reserved map to be set');
          }
        }
      }
    }
  }
}
