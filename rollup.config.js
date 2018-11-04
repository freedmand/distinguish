import {condense} from './index.js';

module.exports = {
  entry: 'test.js',
  plugins: [condense()],

  output: {
    format: 'es',
    //   file: 'test2.js',
  },
};
