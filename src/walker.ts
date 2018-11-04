import fs from 'fs';
import path from 'path';
import MagicString from 'magic-string';
import {Renamer} from './renamer';
import {NamespecParser, Namespec} from './namespec';
import {MinimalIncrementer} from './incrementer';

interface WalkResult {
  inputFile: string;
  outputFile: string;
  renamer: Renamer;
}

const NAMESPEC = '.namespec';

function walkSync(
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
    renamer = renamer.namespace(Renamer.pathSpecToParts(namespec.namespace));
    for (const [importName, importMap] of namespec.imports.entries()) {
      for (const [type, names] of importMap.entries()) {
        for (const name of names) {
          renamer.import(importName, type, name);
        }
      }
    }
  }

  const files = fs.readdirSync(dir == '' ? '.' : dir);
  files.forEach(file => {
    const fn = `${dir}${file}`;
    if (fs.statSync(fn).isDirectory()) {
      filelist = walkSync(`${fn}/`, `${outDir}${file}`, renamer, filelist);
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

const INPUT = 'concept';
const OUTPUT = 'concept_out';

const types = ['cls', 'id'];
const rootRenamer = new Renamer(MinimalIncrementer, types);

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

for (const {inputFile, outputFile, renamer} of walkSync(
  'concept',
  'concept_out',
  rootRenamer
)) {
  const contentsString = fs.readFileSync(inputFile).toString();
  const contents = new MagicString(contentsString);

  let hadMatches = false;
  for (const type of types) {
    // Find all matches.
    const matches = getAllMatches(
      new RegExp(`_(${type})-([a-zA-Z0-9_-]+)`, 'g'),
      contentsString
    );
    for (let i = 0; i < matches.length; i++) {
      hadMatches = true; // there was at least a match somewhere
      const [fullMatch, typeMatch, name] = matches[i];
      const {index} = matches[i];
      const renamed = renamer.addName(typeMatch, name);
      contents.overwrite(index, index + fullMatch.length, renamed);
    }
  }

  if (hadMatches) {
    console.log(`Writing ${outputFile} with namespace ${renamer.namespaces.join('/')}`);
  }

  ensureDirectoryExistence(outputFile);
  fs.writeFileSync(outputFile, contents.toString());
}
