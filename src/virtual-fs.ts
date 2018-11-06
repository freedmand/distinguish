/**
 * Returns the directory name for a file. Do not depend on fs so we can play with this
 * library in the browser.
 * @param fn The file name
 */
function getDir(fn: string): {directory: string; tail: string} {
  let addSlashLater = false;
  if (fn.endsWith('/')) {
    fn = fn.substr(0, fn.length - 1);
    addSlashLater = true;
  }
  const parts = fn.split('/');
  return {
    directory: parts.slice(0, parts.length - 1).join('/') + '/',
    tail: parts[parts.length - 1] + (addSlashLater ? '/' : ''),
  };
}

export interface BaseFs {
  existsSync(path: string): boolean;

  readFileSync(fn: string): {toString(): string};

  readdirSync(fn: string): string[];

  statSync(fn: string): {isDirectory(): boolean};

  writeFileSync(fn: string, contents: string): void;

  mkdirSync(dir: string): void;
}

export class VirtualFs implements BaseFs {
  public directories: Map<string, Set<string>> = new Map();
  public fileMap: Map<string, string> = new Map();

  dirname(path: string): string {
    return getDir(path).directory;
  }

  join(...parts: string[]): string {
    const trailingSlash = parts[parts.length - 1].endsWith('/');
    return (
      parts.map(x => (x.endsWith('/') ? x.substr(0, x.length - 1) : x)).join('/') +
      (trailingSlash ? '/' : '')
    );
  }

  require(path: string): any {
    const contents = this.readFileSync(path).toString();

    const sandbox = {};
    const wrappedCode = `
      void function(exports) {
        ${contents}
      }(sandbox)`;
    eval(wrappedCode);

    return sandbox;
  }

  setDirectory(fnOrDir: string) {
    // Base case.
    if (fnOrDir == '/') return;

    // Create directories recursively.
    this.mkdirSync(fnOrDir);
  }

  statSync(fn: string): {isDirectory(): boolean} {
    // Pretty naive directory checking.
    if (fn.endsWith('/')) {
      return {
        isDirectory() {
          return true;
        },
      };
    }
    return {
      isDirectory() {
        return false;
      },
    };
  }

  mkdirSync(dir: string) {
    const {directory: parentDir, tail} = getDir(dir);

    const directorySet = this.directories.get(parentDir);
    if (directorySet != null) {
      directorySet.add(tail);
    } else {
      this.directories.set(parentDir, new Set([tail]));
    }

    this.setDirectory(parentDir);
  }

  writeFileSync(fn: string, contents: string) {
    this.fileMap.set(fn, contents);
    this.setDirectory(fn);
  }

  existsSync(fn: string): boolean {
    if (!fn.endsWith('/')) {
      // File existence check.
      return this.fileMap.has(fn);
    } else {
      if (fn == '/') return true; // root always exists.
      // Check directory existence.
      const {directory: parentDir, tail} = getDir(fn);
      const directorySet = this.directories.get(parentDir);
      if (directorySet != null) return directorySet.has(tail);
      return false;
    }
  }

  readFileSync(fn: string): {toString(): string} {
    const contents = this.fileMap.get(fn) as string;
    return {
      toString() {
        return contents;
      },
    };
  }

  readdirSync(dir: string): string[] {
    if (!dir.endsWith('/')) dir += '/';
    const directorySet = this.directories.get(dir);
    if (directorySet == null) return [];
    return Array.from(directorySet.values()).sort();
  }
}
