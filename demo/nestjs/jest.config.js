const path = require('path');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // Transform all TypeScript files, including those outside rootDir
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  // Don't ignore the parent test directory - we need to transform those files
  transformIgnorePatterns: [
    'node_modules/(?!(fast-check)/)',
  ],
  moduleNameMapper: {
    '^tscim$': path.resolve(__dirname, '../../build/esm/index.js'),
    '^tscim/(.*)$': path.resolve(__dirname, '../../build/esm/$1'),
    // Map the test directory so Jest can find and transform it
    '^@test/(.*)$': path.resolve(__dirname, '../../test/$1'),
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

