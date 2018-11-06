#!/usr/bin/env node
import {CLI} from './cli';
import fs from 'fs';
import path from 'path';
import process from 'process';

const version = require('../package.json').version;

new CLI(
  version,
  process.argv.slice(2),
  fs,
  require,
  path.dirname,
  path.join,
  process.cwd
).process();
