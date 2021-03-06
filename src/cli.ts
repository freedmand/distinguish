#!/usr/bin/env node

import {logStyle, SUCCESS, FAIL, BOLD, STATUS, WARN, STATUS_BOLD} from './log';
import fs from 'fs';
import path from 'path';
import {Distinguisher, DistinguishConfig} from './distinguisher';
import {BaseFs} from './virtual-fs';

const VALID_INCREMENTERS = ['simple', 'module', 'minimal'];

const EMPTY_CONFIG = `exports.default = {
  incrementer: 'simple', // the incrementer to use ([minimal, simple, module])
  types: ['cls', 'id'], // the types to rename (e.g. CSS classes, IDs)

  inputDir: 'src/', // the input directory to use
  outputDir: 'out/', // the output directory to use

  exclude: [], // a regular expression array describing files to exclude from renaming
};
`;

const RESET_TO_APPLY = '\nConfig changed. Run again to pull in latest config';

const POLL_INTERVAL = 50; // pool watch events for this many millseconds

const DEFAULT_CONFIG_FN = 'distinguish.config.js';
const BINARY_NAME = 'distinguish';

const SPLASH_SCREEN = `      _ _     _   _                   _     _     
     | (_)   | | (_)                 (_)   | |    
   __| |_ ___| |_ _ _ __   __ _ _   _ _ ___| |__  
  / _\` | / __| __| | '_ \\ / _\` | | | | / __| '_ \\ 
 | (_| | \\__ \\ |_| | | | | (_| | |_| | \\__ \\ | | |
  \\__,_|_|___/\\__|_|_| |_|\\__, |\\__,_|_|___/_| |_|
                           __/ |                  
                          |___/                   
`;

function configMissing(path: string) {
  return `Unable to read in ${path}.
      
  Maybe you need to create a config file first by running:
  
    distinguish init
  `;
}

abstract class CLIParser {
  constructor(
    public stream: string[],
    readonly fs: BaseFs,
    readonly requireFn: (module: string) => any,
    readonly dirname: (path: string) => string,
    readonly join: (...parts: string[]) => string,
    readonly cwd: () => string,
    readonly returnOptsOnly: boolean = false,
    readonly parent?: CLIParser
  ) {}

  moreArguments(): boolean {
    if (this.stream.length == 0) {
      if (!this.returnOptsOnly) {
        logStyle(FAIL, `Expected additional arguments\n`);
      }
      return false;
    }
    return true;
  }

  noMoreArguments(): boolean {
    if (this.stream.length != 0) {
      if (!this.returnOptsOnly) {
        logStyle(FAIL, `Encountered extraneous arguments: ${this.stream}\n`);
      }
      return false;
    }
    return true;
  }

  advance() {
    this.stream = this.stream.slice(1);
  }

  consume(s: string) {
    const token = this.stream[0];
    if (token == s) return true;
    return false;
  }

  consumeOption(forms: string[]) {
    for (const form of forms) {
      if (this.consume(form)) return true;
    }
    return false;
  }
}

export interface RenameOptions {
  configFile?: string;
  incrementer?: string;
  types?: string[];
  inputDir?: string;
  outputDir?: string;
  exclude?: RegExp[];
  watch?: boolean;
}

export interface CLIResult {
  opts?: RenameOptions;
  initFn?: string;
  showVersion?: boolean;
  showUsage?: string;
  showSplash?: boolean;
}

class RenameCLI extends CLIParser {
  process(): CLIResult {
    let expectConfig = false;
    let expectIncrementer = false;
    let expectTypes = false;
    let expectInputDir = false;
    let expectOutputDir = false;
    let expectExclude = false;

    const noOpts = this.stream.length == 0;

    const opts: RenameOptions = {configFile: DEFAULT_CONFIG_FN};
    while (this.stream.length > 0) {
      // Go through expectations.
      if (expectIncrementer) {
        if (!this.moreArguments()) {
          return this.showUsage();
        }
        const incrementer = this.stream[0];
        this.advance();
        if (VALID_INCREMENTERS.indexOf(incrementer) == -1) {
          if (!this.returnOptsOnly) {
            logStyle(
              FAIL,
              `Expected an incrementer in the set ${VALID_INCREMENTERS}\n`
            );
          }
          return this.showUsage();
        }
        opts.incrementer = incrementer;
        expectIncrementer = false;
        continue;
      }

      if (expectTypes) {
        if (!this.moreArguments()) {
          return this.showUsage();
        }
        opts.types = this.stream[0].split(',');
        this.advance();
        expectTypes = false;
        continue;
      }

      if (expectInputDir) {
        if (!this.moreArguments()) {
          return this.showUsage();
        }
        opts.inputDir = this.stream[0];
        this.advance();
        expectInputDir = false;
        continue;
      }

      if (expectOutputDir) {
        if (!this.moreArguments()) {
          return this.showUsage();
        }
        opts.outputDir = this.stream[0];
        this.advance();
        expectOutputDir = false;
        continue;
      }

      if (expectExclude) {
        if (!this.moreArguments()) {
          return this.showUsage();
        }
        opts.exclude = this.stream[0].split(',').map(x => new RegExp(x));
        this.advance();
        expectExclude = false;
        continue;
      }

      // Consume options.
      if (this.consumeOption(['-c', '--config'])) {
        expectConfig = true;
        opts.configFile = DEFAULT_CONFIG_FN;
        this.advance();
        continue;
      }

      if (this.consumeOption(['-w', '--watch'])) {
        expectConfig = true;
        opts.watch = true;
        this.advance();
        continue;
      }

      if (this.consumeOption(['-n', '--incrementer'])) {
        expectIncrementer = true;
        this.advance();
        continue;
      }

      if (this.consumeOption(['-t', '--types'])) {
        expectTypes = true;
        this.advance();
        continue;
      }

      if (this.consumeOption(['-i', '--inputDir'])) {
        expectInputDir = true;
        this.advance();
        continue;
      }

      if (this.consumeOption(['-o', '--outputDir'])) {
        expectOutputDir = true;
        this.advance();
        continue;
      }

      if (this.consumeOption(['-e', '--exclude'])) {
        expectExclude = true;
        this.advance();
        continue;
      }

      // If nothing was consumed and expectConfig is on, let's check for one.
      if (!this.moreArguments() || !expectConfig) {
        return this.showUsage();
      }
      opts.configFile = this.stream[0];
      if (opts.configFile.startsWith('-')) return this.showUsage();
      expectConfig = false;
      this.advance();
    }

    // Now that we're done processing, let's make sense of the args.

    // If no options were specified, put in the default config file.
    if (noOpts) opts.configFile = DEFAULT_CONFIG_FN;

    if (opts.configFile == null) {
      // Set defaults if no config specified.
      if (opts.incrementer == null) opts.incrementer = 'simple';
      if (opts.types == null) opts.types = ['cls', 'id'];
      if (opts.exclude == null) opts.exclude = [];
    } else {
      // Load in the config file.
      if (!this.returnOptsOnly) {
        opts.configFile = path.join(process.cwd(), opts.configFile);
      }
      if (!this.fs.existsSync(opts.configFile)) {
        if (!this.returnOptsOnly) {
          logStyle(FAIL, configMissing(opts.configFile));
        }
        return this.showUsage();
      }
      const settings = this.requireFn(opts.configFile).default;

      if (settings == undefined) {
        if (!this.returnOptsOnly) {
          logStyle(FAIL, configMissing(opts.configFile));
        }
        return this.showUsage();
      }

      if (opts.incrementer == null) opts.incrementer = settings.incrementer;
      if (opts.types == null) opts.types = settings.types;
      if (opts.inputDir == null) opts.inputDir = settings.inputDir;
      if (opts.outputDir == null) opts.outputDir = settings.outputDir;
      if (opts.exclude == null) opts.exclude = settings.exclude;
    }

    // Run time.
    if (!this.returnOptsOnly) {
      console.log('Run settings:\n', opts);
      console.log();

      let distinguisher = new Distinguisher(
        opts as DistinguishConfig,
        this.fs,
        this.dirname,
        !this.returnOptsOnly
      );
      distinguisher.run();

      if (opts.watch != null) {
        const chokidar = this.requireFn('chokidar');

        let count = 1;

        let timer: any = setTimeout(() => (timer = null), POLL_INTERVAL);

        chokidar
          .watch(opts.configFile)
          .on('change', () => {
            logStyle(FAIL, RESET_TO_APPLY);
            process.exit(0);
          })
          .on('unlink', () => {
            logStyle(FAIL, RESET_TO_APPLY);
            process.exit(0);
          });

        chokidar
          .watch(opts.inputDir, {ignored: opts.exclude != null ? opts.exclude : []})
          .on('all', (event: any, path: string) => {
            if (opts.configFile != null && path == opts.configFile) {
              logStyle(FAIL, RESET_TO_APPLY);
              process.exit(0);
            }

            if (timer == null) {
              timer = setTimeout(() => {
                logStyle(
                  STATUS_BOLD,
                  `\n\nFiles changed, re-distinguishing (#${count++})`
                );
                distinguisher.run();
                timer = null;
              }, POLL_INTERVAL);
            }
          });
      }
    }
    return {opts};
  }

  showUsage(): CLIResult {
    if (!this.returnOptsOnly) {
      console.log(`Usage: ${BINARY_NAME} rename [options]

  rename and namespace files recursively in a directory

Options:
  -c, --config [fn]         Load all the settings from a config file.
                            (default if no value passed: ${DEFAULT_CONFIG_FN})

  -w, --watch               Watch the input directory for any changes. Re-run
                            automatically if anything changes in the input directory or
                            any of its sub-directories.

Config options / overrides:
  -n, --incrementer <str>   Specify the incrementer to use.
                            Options are 'simple', 'module', or 'minimal'
                            (default if no config specified: simple)

  -t, --types <list>        Specify a list of types to rename
                            (default if no config specified: cls,id)

  -i, --inputDir <dir>      The input directory to use
                            (this arg is mandatory if no config is specified)

  -o, --outputDir <dir>     The output directory to use
                            (this arg is mandatory if no config is specified)

  -e, --exclude <list>      Regular expression of paths to exclude renaming.
                            It is recommended to set this in a config file to
                            have more control.
                            (default: empty list)
`);
      process.exit(1);
    }
    return {showUsage: 'rename'};
  }
}

class InitCLI extends CLIParser {
  process(): CLIResult {
    let fn = DEFAULT_CONFIG_FN;
    if (this.stream.length > 0) {
      fn = this.stream[0];
      if (fn.startsWith('-')) return this.showUsage();
      this.advance();
      if (!this.noMoreArguments()) return this.showUsage();
    }

    if (!this.returnOptsOnly) {
      const startTime = Date.now();
      fs.writeFileSync(fn, EMPTY_CONFIG);
      const deltaTime = Date.now() - startTime;
      logStyle(SUCCESS, `Wrote config to ${fn} in ${deltaTime / 1000}s`);
    }
    return {initFn: fn};
  }

  showUsage(): CLIResult {
    if (!this.returnOptsOnly) {
      console.log(`Usage: ${BINARY_NAME} init <fn>

  create a default distinguish config file

Arguments:
  fn        The file to create.
            (default: ${DEFAULT_CONFIG_FN})
`);
      process.exit(1);
    }
    return {showUsage: 'init'};
  }
}

export class CLI extends CLIParser {
  constructor(
    readonly version: string | null,
    args: string[],
    fs: BaseFs,
    requireFn: (module: string) => any,
    dirname: (path: string) => string,
    join: (...parts: string[]) => string,
    cwd: () => string,
    returnOptsOnly: boolean = false
  ) {
    super(args, fs, requireFn, dirname, join, cwd, returnOptsOnly);
  }

  process(): CLIResult {
    // Try to consume options.
    if (this.consumeOption(['-v', '--version'])) return this.showVersion();
    if (this.consumeOption(['-h', '--help', '--usage'])) return this.showUsage();
    if (this.consumeOption(['--splash'])) return this.showSplash();

    // Try to consume sub-commands.

    if (this.consumeOption(['init'])) {
      return new InitCLI(
        this.stream.slice(1),
        this.fs,
        this.requireFn,
        this.dirname,
        this.join,
        this.cwd,
        this.returnOptsOnly,
        this
      ).process();
    }

    if (this.consumeOption(['rename'])) {
      return new RenameCLI(
        this.stream.slice(1),
        this.fs,
        this.requireFn,
        this.dirname,
        this.join,
        this.cwd,
        this.returnOptsOnly,
        this
      ).process();
    }

    if (this.consumeOption(['help'])) {
      // Show help menus.
      this.advance();
      if (this.consumeOption(['rename'])) {
        return new RenameCLI(
          this.stream.slice(1),
          this.fs,
          this.requireFn,
          this.dirname,
          this.join,
          this.cwd,
          this.returnOptsOnly,
          this
        ).showUsage();
      }
      if (this.consumeOption(['init'])) {
        return new InitCLI(
          this.stream.slice(1),
          this.fs,
          this.requireFn,
          this.dirname,
          this.join,
          this.cwd,
          this.returnOptsOnly,
          this
        ).showUsage();
      }
      return this.showUsage();
    }

    return this.showUsage();
  }

  showVersion(): CLIResult {
    if (!this.returnOptsOnly) console.log(this.version);
    return {showVersion: true};
  }

  showUsage(): CLIResult {
    if (!this.returnOptsOnly) {
      console.log(`Usage: ${BINARY_NAME} <command> [options]

Commands:
  rename [options]                   rename and namespace files
                                     recursively in a directory

  init <fn=${DEFAULT_CONFIG_FN}>    create a config file

  help [command]                     get options for a given command

Options:
  -v, --version                      print the version
  -h, --help, --usage                print this message
  --splash                           show a fun splash screen
`);
      process.exit(1);
    }
    return {showUsage: 'base'};
  }

  showSplash(): CLIResult {
    if (!this.returnOptsOnly) {
      console.log(SPLASH_SCREEN);
      logStyle(BOLD, 'Effortless renaming, minification, and namespacing');
      logStyle(BOLD, 'for CSS class names, IDs, and just about anything else.\n');
    }
    return {showSplash: true};
  }
}
