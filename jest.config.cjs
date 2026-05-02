/** @type {import('jest').Config} */
const config = {
  // Use Node test environment for Netlify functions
  testEnvironment: 'node',

  // Look for tests in the netlify/functions directory
  testMatch: [
    '**/netlify/functions/__tests__/**/*.test.js'
  ],

  // Transform CommonJS modules
  transform: {},

  // Don't transform node_modules
  transformIgnorePatterns: [
    '/node_modules/'
  ],

  // Module paths for mocks
  modulePathIgnorePatterns: [
    '<rootDir>/dist/'
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/netlify/functions/__tests__/setup.js'],

  // Coverage settings
  collectCoverageFrom: [
    'netlify/functions/**/*.js',
    '!netlify/functions/__tests__/**',
    '!netlify/functions/__mocks__/**'
  ],

  // Verbose output
  verbose: true
}

module.exports = config
