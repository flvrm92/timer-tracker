module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/infra/database.js',
    'src/main/ipcHandlers.js',
    'src/main/index.js',
    'src/settings/preload.js',
    'src/shared/utils/csvUtils.js',
    'src/shared/utils/escapeHtml.js',
    'src/shared/utils/dateHelper.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/'
  ]
};
