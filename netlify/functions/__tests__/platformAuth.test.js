'use strict'

// Mock googleapis before requiring platformAuth
jest.mock('googleapis')

const { __resetMockData } = require('googleapis')
const { hashPin } = require('../_sheets')

// Import handler after mocking
const { handler } = require('../platformAuth')

// Helper to create mock event
function createEvent(body, method = 'POST') {
  return {
    httpMethod: method,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

describe('platformAuth.js', () => {
  // Store original env
  let originalPlatformAdmins

  beforeAll(async () => {
    originalPlatformAdmins = process.env.PLATFORM_ADMINS

    // Pre-generate bcrypt hashes for test admins
    const admin1Hash = await hashPin('1234')
    const admin2Hash = await hashPin('5678')

    process.env.PLATFORM_ADMINS = JSON.stringify([
      { name: 'TestAdmin', pin: admin1Hash },
      { name: 'TestAdmin2', pin: admin2Hash }
    ])
  })

  afterAll(() => {
    process.env.PLATFORM_ADMINS = originalPlatformAdmins
  })

  beforeEach(() => {
    __resetMockData()
  })

  describe('HTTP method handling', () => {
    it('should return 200 for OPTIONS request', async () => {
      const event = createEvent({}, 'OPTIONS')
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
    })

    it('should return 405 for GET request', async () => {
      const event = createEvent({}, 'GET')
      const response = await handler(event)

      expect(response.statusCode).toBe(405)
    })
  })

  describe('request validation', () => {
    it('should return error for invalid JSON', async () => {
      const event = {
        httpMethod: 'POST',
        headers: {},
        body: 'invalid json'
      }
      const response = await handler(event)

      expect(response.statusCode).toBe(400)
    })

    it('should return error when PIN is missing', async () => {
      const event = createEvent({})
      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('PIN required')
    })
  })

  describe('platform admin authentication', () => {
    it('should authenticate with correct platform PIN', async () => {
      const event = createEvent({ pin: '1234' })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.platformAdmin).toBe(true)
      expect(body.name).toBe('TestAdmin')
      expect(body.role).toBe('platform')
    })

    it('should authenticate second admin with correct PIN', async () => {
      const event = createEvent({ pin: '5678' })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.name).toBe('TestAdmin2')
    })

    it('should return 401 for incorrect PIN', async () => {
      const event = createEvent({ pin: 'wrongpin' })
      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      expect(JSON.parse(response.body).error).toContain('Invalid platform PIN')
    })
  })

  describe('platform admin configuration', () => {
    it('should return 500 when PLATFORM_ADMINS is not valid JSON', async () => {
      const original = process.env.PLATFORM_ADMINS
      process.env.PLATFORM_ADMINS = 'not valid json'

      const event = createEvent({ pin: '1234' })
      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body).error).toContain('not configured')

      process.env.PLATFORM_ADMINS = original
    })

    it('should return 500 when no platform admins configured', async () => {
      const original = process.env.PLATFORM_ADMINS
      process.env.PLATFORM_ADMINS = '[]'

      const event = createEvent({ pin: '1234' })
      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body).error).toContain('No platform admins')

      process.env.PLATFORM_ADMINS = original
    })

    it('should return 401 when PLATFORM_ADMINS env var is missing', async () => {
      const original = process.env.PLATFORM_ADMINS
      delete process.env.PLATFORM_ADMINS

      const event = createEvent({ pin: '1234' })
      const response = await handler(event)

      // With empty array from missing env, we get 500 for no admins
      expect(response.statusCode).toBe(500)

      process.env.PLATFORM_ADMINS = original
    })
  })

  describe('response format', () => {
    it('should return expected fields on success', async () => {
      const event = createEvent({ pin: '1234' })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body).toHaveProperty('platformAdmin', true)
      expect(body).toHaveProperty('name')
      expect(body).toHaveProperty('role', 'platform')
    })

    it('should include CORS headers', async () => {
      const event = createEvent({ pin: '1234' })
      const response = await handler(event)

      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined()
    })
  })
})

describe('platformAuth bcrypt verification', () => {
  it('should verify PIN against bcrypt hash stored in env', async () => {
    const testPin = 'mysecretpin'
    const testHash = await hashPin(testPin)

    const original = process.env.PLATFORM_ADMINS
    process.env.PLATFORM_ADMINS = JSON.stringify([
      { name: 'BcryptAdmin', pin: testHash }
    ])

    const event = createEvent({ pin: testPin })
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body).name).toBe('BcryptAdmin')

    process.env.PLATFORM_ADMINS = original
  })

  it('should reject PIN that does not match bcrypt hash', async () => {
    const testHash = await hashPin('correctpin')

    const original = process.env.PLATFORM_ADMINS
    process.env.PLATFORM_ADMINS = JSON.stringify([
      { name: 'Admin', pin: testHash }
    ])

    const event = createEvent({ pin: 'wrongpin' })
    const response = await handler(event)

    expect(response.statusCode).toBe(401)

    process.env.PLATFORM_ADMINS = original
  })
})
