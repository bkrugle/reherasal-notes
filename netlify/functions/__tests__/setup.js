'use strict'

// Set up environment variables for tests
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'test-key-id',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBALRiMLAHudeSA2xnwx8PIR1HNyP5TMebiF2bH4P5r5EiZ0CXFTJZ\ndLakiZ4cZwTsZG4VmwfCxGgXq4Q5QKKwvYkCAwEAAQJAYPFFQs1YMBCXS4ND7J+N\nFR0YQe4D6lqDkRQBGRYqfDMWKvE4kRmNE1FYAuU0J7M5CKjKYzE0xnYJZmL4dwJB\nAQIhANZiJVqLx1/S5nPPLLOiP3+GBqN7PK7O3BYZvxSHQG8bAiEA1p7J3EXPppJN\nvEaRPrRmJLlRVJL9Fn5E0fDLNqwvaxsCIBqQnN3u6J55YD0r2d4/X9QdvFB+lLUd\nFPf7HmdT0ElRAiEAwBRFXxNGnL8mNNKq1/G6w5H1L3qDbkv1u56U9GlKUZsCIBFx\n8B5XpH1+d+CBy/N5lOjTT6xYLOSNnPYv3zHUxwKd\n-----END RSA PRIVATE KEY-----\n',
  client_email: 'test@test-project.iam.gserviceaccount.com',
  client_id: '123456789',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token'
})

process.env.REGISTRY_SHEET_ID = 'test-registry-sheet-id'

process.env.PLATFORM_ADMINS = JSON.stringify([
  { name: 'TestAdmin', pin: '1234' },
  { name: 'TestAdmin2', pin: '5678' }
])

// Increase timeout for async tests
jest.setTimeout(10000)
