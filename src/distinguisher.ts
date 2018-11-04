import fs from 'fs';
import path from 'path';
import MagicString from 'magic-string';
import {Renamer} from './renamer';
import {NamespecParser} from './namespec';
import {
  MinimalIncrementer,
  SimpleIncrementer,
  ModuleIncrementer,
  Incrementer,
} from './incrementer';
import {logStyle, STATUS, WARN, BOLD} from './log';

interface WalkResult {
  inputFile: string;
  outputFile: string;
  renamer: Renamer;
}

const NAMESPEC = '.namespec';

// Adapted from https://stackoverflow.com/a/34509653
function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) return;
  ensureDirectoryExistence(dirname);
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

  constructor(readonly distinguishConfig: DistinguishConfig) {
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
    if (fs.existsSync(namespecPath)) {
      // Parse a namespec file to determine the renamer's new scope.
      const namespec = new NamespecParser(
        fs.readFileSync(namespecPath).toString()
      ).parse();

      // Set the namespace.
      renamer = renamer.namespace(Renamer.pathSpecToParts(namespec.namespace));

      // Set imports.
      for (const [importName, importMap] of namespec.imports.entries()) {
        for (const [type, names] of importMap.entries()) {
          for (const name of names) {
            renamer.import(importName, type, name);
          }
        }
      }

      // Set reserves.
      for (const [type, reserves] of namespec.reserves.entries()) {
        for (const reserveName of reserves.values()) {
          renamer.reserve(type, reserveName);
        }
      }
    }

    const files = fs.readdirSync(dir == '' ? '.' : dir);
    files.forEach(file => {
      const fn = `${dir}${file}`;
      for (const exclude of this.distinguishConfig.exclude) {
        if (fn.match(exclude) != null) continue;
      }
      if (fs.statSync(fn).isDirectory()) {
        filelist = this.walkSync(`${fn}/`, `${outDir}${file}`, renamer, filelist);
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
      let contents = fs.readFileSync(inputFile).toString();

      let hadMatches = false;
      for (const type of this.distinguishConfig.types) {
        // Find all matches.
        const matches = getAllMatches(
          new RegExp(`_(${type})-([a-zA-Z0-9_-]+)`, 'g'),
          contents
        );
        for (let i = matches.length - 1; i >= 0; i--) {
          // Iterate in reverse order to safely overwrite.
          hadMatches = true; // there was at least a match somewhere
          const [fullMatch, typeMatch, name] = matches[i];
          const {index} = matches[i];
          const renamed = renamer.addName(typeMatch, name);
          contents =
            contents.substr(0, index) +
            renamed +
            contents.substr(index + fullMatch.length);
        }
      }

      if (hadMatches) {
        logStyle(
          STATUS,
          `Writing ${outputFile} with namespace ${renamer.namespaces.join('/')}`
        );
      }

      ensureDirectoryExistence(outputFile);
      fs.writeFileSync(outputFile, contents.toString());
    }

    const overallTime = Date.now() - startTime;
    logStyle(BOLD, `\nWrote output in ${overallTime / 1000}s`);

    const danglers = this.rootRenamer.danglingImports();
    if (danglers.length > 0) console.log('\n');
    for (const {sourceNamespace, importNamespace, type, name} of danglers) {
      logStyle(
        WARN,
        `Dangling import: ${sourceNamespace} imports unused {type: ${type}, name: ${name}} from ${importNamespace}`
      );
    }
  }
}
