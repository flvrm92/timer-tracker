module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/infra/database.js',
    'src/main/ipcHandlers.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/'
  ]
};
