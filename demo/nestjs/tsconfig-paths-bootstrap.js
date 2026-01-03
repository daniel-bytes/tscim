// This file configures tsconfig-paths to resolve 'tscim' to the built output at runtime
const tsConfigPaths = require('tsconfig-paths');
const path = require('path');

const baseUrl = path.resolve(__dirname);
const paths = {
  'tscim': [path.resolve(__dirname, '../../build/esm/index.js')],
  'tscim/*': [path.resolve(__dirname, '../../build/esm/*')],
};

tsConfigPaths.register({
  baseUrl,
  paths,
});

