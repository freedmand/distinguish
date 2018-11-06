import typescript from 'rollup-plugin-typescript';

export default {
  input: './src/web_index.ts',
  output: {
    file: './build/index.js',
    format: 'cjs',
  },
  plugins: [typescript()],
};
