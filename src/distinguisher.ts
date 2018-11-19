import {Renamer} from './renamer';
import {NamespecParser, Namespec} from './namespec';
import {
  MinimalIncrementer,
  SimpleIncrementer,
  ModuleIncrementer,
  Incrementer,
} from './incrementer';
import {logStyle, STATUS, WARN, BOLD, FAIL} from './log';
import {BaseFs} from './virtual-fs';

interface WalkResult {
  inputFile: string;
  outputFile: string;
  renamer: Renamer;
}

const NAMESPEC = '.namespec';

// Adapted from https://stackoverflow.com/a/34509653
function ensureDirectoryExistence(
  filePath: string,
  dirnameFn: (path: string) => string,
  fs: BaseFs
) {
  const dirname = dirnameFn(filePath);
  if (fs.existsSync(dirname)) return;
  ensureDirectoryExistence(dirname, dirnameFn, fs);
  fs.mkdirSync(dirname);
}

function getAllMatches(regex: RegExp, str: string): RegExpExecArray[] {
  var result;
  const results = [];
  while ((result = regex.exec(str)) !== null) {
    results.push(result);
  }
  return results;
}

const incrementers: {[index: string]: {new (): Incrementer}} = {
  minimal: MinimalIncrementer,
  simple: SimpleIncrementer,
  module: ModuleIncrementer,
};

export interface DistinguishConfig {
  inputDir: string;
  outputDir: string;
  incrementer: string;
  types: string[];
  exclude: RegExp[];
}

export class Distinguisher {
  public rootRenamer: Renamer;

  constructor(
    readonly distinguishConfig: DistinguishConfig,
    readonly fs: BaseFs,
    readonly dirnameFn: (path: string) => string,
    readonly logging: boolean = true
  ) {
    const incrementer = incrementers[distinguishConfig.incrementer] as {
      new (): Incrementer;
    };
    this.rootRenamer = new Renamer(incrementer, distinguishConfig.types);
  }

  walkSync(
    dir: string = '',
    outDir: string = '',
    renamer: Renamer,
    filelist: WalkResult[] = []
  ): WalkResult[] {
    if (!dir.endsWith('/')) dir += '/';
    if (!outDir.endsWith('/')) outDir += '/';

    const namespecPath = `${dir}${NAMESPEC}`;
    if (this.fs.existsSync(namespecPath)) {
      // Parse a namespec file to determine the renamer's new scope.
      let namespec: Namespec | null = null;
      // try {
      namespec = new NamespecParser(
        this.fs.readFileSync(namespecPath).toString()
      ).parse();
      // } catch (e) {
      // logStyle(FAIL, `Error parsing ${namespecPath}: ${e}`);
      // }

      if (namespec != null) {
        // Set the namespace.
        renamer = renamer.namespace(Renamer.pathSpecToParts(namespec.namespace));

        // Set imports.
        for (const [importName, importMap] of Array.from(namespec.imports.entries())) {
          for (const [type, names] of Array.from(importMap.entries())) {
            for (const name of names) {
              renamer.import(importName, type, name);
            }
          }
        }

        // Set reserves.
        for (const [type, reserves] of Array.from(namespec.reserves.entries())) {
          for (const [nameValue] of Array.from(reserves.values())) {
            renamer.reserve(type, nameValue);
          }
        }

        // Set declares.
        for (const [type, declares] of Array.from(namespec.declares.entries())) {
          for (const [nameValue, varValue] of Array.from(declares.entries())) {
            renamer.declare(type, nameValue, varValue);
          }
        }
      }
    }

    const files = this.fs.readdirSync(dir == '' ? '.' : dir);
    files.forEach(file => {
      const fn = `${dir}${file}`;
      for (const exclude of this.distinguishConfig.exclude) {
        if (fn.match(exclude) != null) continue;
      }
      if (this.fs.statSync(fn).isDirectory()) {
        filelist = this.walkSync(
          `${fn + (fn.endsWith('/') ? '' : '/')}`,
          `${outDir}${file}`,
          renamer,
          filelist
        );
      } else {
        filelist.push({
          inputFile: `${dir}${file}`,
          outputFile: `${outDir}${file}`,
          renamer,
        });
      }
    });
    return filelist;
  }

  run() {
    const startTime = Date.now();
    for (const {inputFile, outputFile, renamer} of this.walkSync(
      this.distinguishConfig.inputDir,
      this.distinguishConfig.outputDir,
      this.rootRenamer
    )) {
      let contents = this.fs.readFileSync(inputFile).toString();

      let hadMatches = false;
      for (const type of this.distinguishConfig.types) {
        // Find all matches.
        const matches = getAllMatches(
          new RegExp(`_(${type})[\$-]([a-zA-Z0-9-]+)_?`, 'g'),
          contents
        );
        let offset = 0;
        for (let i = 0; i < matches.length; i++) {
          // Iterate in correct order and keep track of offset.
          hadMatches = true; // there was at least a match somewhere
          const [fullMatch, typeMatch, name] = matches[i];
          let {index} = matches[i];
          index -= offset;
          const renamed = renamer.addName(typeMatch, name);
          offset += fullMatch.length - renamed.length;

          contents =
            contents.substr(0, index) +
            renamed +
            contents.substr(index + fullMatch.length);
        }
      }

      if (this.logging && hadMatches) {
        logStyle(
          STATUS,
          `Writing ${outputFile} with namespace ${renamer.namespaces.join('/')}`
        );
      }

      ensureDirectoryExistence(outputFile, this.dirnameFn, this.fs);
      this.fs.writeFileSync(outputFile, contents.toString());
    }

    const overallTime = Date.now() - startTime;
    if (this.logging) logStyle(BOLD, `\nWrote output in ${overallTime / 1000}s`);

    const danglers = this.rootRenamer.danglingImports();
    if (this.logging && danglers.length > 0) console.log('\n');
    for (const {sourceNamespace, importNamespace, type, name} of danglers) {
      if (this.logging) {
        logStyle(
          WARN,
          `Dangling import: ${sourceNamespace} imports unused {type: ${type}, name: ${name}} from ${importNamespace}`
        );
      }
    }
  }
}
