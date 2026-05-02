'use strict'

// Mock googleapis before requiring authenticate
jest.mock('googleapis')

const { __setMockSheetData, __resetMockData } = require('googleapis')
const { hashPin } = require('../_sheets')

// Import handler after mocking
const { handler } = require('../authenticate')

// Counter for generating unique IPs to avoid rate limiting between tests
let ipCounter = 0

// Helper to create mock event with unique IP to avoid rate limiting
function createEvent(body, method = 'POST', headers = {}) {
  ipCounter++
  return {
    httpMethod: method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`,
      ...headers
    },
    body: JSON.stringify(body)
  }
}

describe('authenticate.js', () => {
  beforeEach(() => {
    __resetMockData()
  })

  describe('HTTP method handling', () => {
    it('should return 200 for OPTIONS request (CORS preflight)', async () => {
      const event = createEvent({}, 'OPTIONS')
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
    })

    it('should return 405 for GET request', async () => {
      const event = createEvent({}, 'GET')
      const response = await handler(event)

      expect(response.statusCode).toBe(405)
    })

    it('should return 405 for PUT request', async () => {
      const event = createEvent({}, 'PUT')
      const response = await handler(event)

      expect(response.statusCode).toBe(405)
    })
  })

  describe('request validation', () => {
    it('should return error for invalid JSON body', async () => {
      const event = {
        httpMethod: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.99.0.1' },
        body: 'not valid json'
      }
      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('Invalid JSON')
    })

    it('should return error when productionCode is missing', async () => {
      const event = createEvent({ pin: '1234' })
      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('required')
    })

    it('should return error when PIN is missing', async () => {
      const event = createEvent({ productionCode: 'TEST123' })
      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('required')
    })
  })

  describe('production authentication', () => {
    it('should return 404 for non-existent production code', async () => {
      const event = createEvent({
        productionCode: 'NONEXISTENT',
        pin: '1234'
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(404)
      expect(JSON.parse(response.body).error).toContain('not found')
    })

    it('should authenticate with correct member PIN', async () => {
      // Set up mock data with bcrypt hash
      const pin = '1234'
      const pinHash = await hashPin(pin)

      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', pinHash, 'adminhash', '2024-01-01']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: pin
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.productionCode).toBe('TEST123')
      expect(body.role).toBe('member')
    })

    it('should authenticate with correct admin PIN', async () => {
      const pin = 'adminpin'
      const adminPinHash = await hashPin(pin)

      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', 'memberhash', adminPinHash, '2024-01-01']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: pin
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.role).toBe('admin')
    })

    it('should return 401 for incorrect PIN', async () => {
      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', await hashPin('correct'), await hashPin('admin'), '2024-01-01']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: 'wrongpin'
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      expect(JSON.parse(response.body).error).toContain('Incorrect PIN')
    })

    it('should be case-insensitive for production code', async () => {
      const pin = '1234'
      const pinHash = await hashPin(pin)

      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', pinHash, 'adminhash', '2024-01-01']
      ])

      const event = createEvent({
        productionCode: 'test123',  // lowercase
        pin: pin
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.productionCode).toBe('TEST123')  // returned as uppercase
    })
  })

  describe('shared member authentication', () => {
    it('should authenticate shared member with correct PIN', async () => {
      const memberPin = 'memberpin'
      const memberPinHash = await hashPin(memberPin)

      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', 'mainpin', 'adminpin', '2024-01-01']
      ])

      __setMockSheetData('test-sheet-id', 'SharedWith!A:I', [
        ['name', 'email', 'pinHash', 'inviteCode', 'activated', 'role', 'staffRole', 'ntfyTopic', 'phone'],
        ['John Doe', 'john@example.com', memberPinHash, '', 'true', 'member', 'Actor', '', '555-1234']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: memberPin
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.role).toBe('shared')
      expect(body.name).toBe('John Doe')
      expect(body.email).toBe('john@example.com')
    })

    it('should authenticate shared admin with admin role', async () => {
      const adminPin = 'sharedadmin'
      const adminPinHash = await hashPin(adminPin)

      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', 'mainpin', 'adminpin', '2024-01-01']
      ])

      __setMockSheetData('test-sheet-id', 'SharedWith!A:I', [
        ['name', 'email', 'pinHash', 'inviteCode', 'activated', 'role', 'staffRole', 'ntfyTopic', 'phone'],
        ['Jane Admin', 'jane@example.com', adminPinHash, '', 'true', 'admin', 'Director', '', '555-9999']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: adminPin
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.role).toBe('admin')
    })
  })

  describe('invite code flow', () => {
    it('should recognize valid invite code', async () => {
      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', 'mainpin', 'adminpin', '2024-01-01']
      ])

      __setMockSheetData('test-sheet-id', 'SharedWith!A:I', [
        ['name', 'email', 'pinHash', 'inviteCode', 'activated', 'role', 'staffRole', 'ntfyTopic', 'phone'],
        ['New User', 'new@example.com', '', 'INVITE01', 'false', 'member', '', '', '']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: 'INVITE01'  // Using invite code as PIN
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('invite_valid')
      expect(body.inviteCode).toBe('INVITE01')
    })

    it('should not accept already activated invite code', async () => {
      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', 'mainpin', 'adminpin', '2024-01-01']
      ])

      __setMockSheetData('test-sheet-id', 'SharedWith!A:I', [
        ['name', 'email', 'pinHash', 'inviteCode', 'activated', 'role', 'staffRole', 'ntfyTopic', 'phone'],
        ['Used User', 'used@example.com', 'existinghash', 'USEDCODE', 'true', 'member', '', '', '']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: 'USEDCODE'
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(401)
    })
  })

  describe('rate limiting', () => {
    it('should include CORS headers even on rate limit', async () => {
      // Make many requests to trigger rate limit - use fixed IP
      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100'
        },
        body: JSON.stringify({
          productionCode: 'TEST123',
          pin: 'wrongpin'
        })
      }

      let response
      // Make 15 requests (limit is 10)
      for (let i = 0; i < 15; i++) {
        response = await handler(event)
      }

      // Should be rate limited
      expect(response.statusCode).toBe(429)
      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined()
    })
  })

  describe('response format', () => {
    it('should return expected fields on successful auth', async () => {
      const pin = '1234'
      const pinHash = await hashPin(pin)

      __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
        ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
        ['TEST123', 'Test Production', 'test-sheet-id', pinHash, 'adminhash', '2024-01-01']
      ])

      const event = createEvent({
        productionCode: 'TEST123',
        pin: pin
      })
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body).toHaveProperty('productionCode')
      expect(body).toHaveProperty('title')
      expect(body).toHaveProperty('sheetId')
      expect(body).toHaveProperty('role')
    })

    it('should always return JSON content type', async () => {
      const event = createEvent({
        productionCode: 'TEST123',
        pin: '1234'
      })
      const response = await handler(event)

      expect(response.headers['Content-Type']).toBe('application/json')
    })
  })
})

describe('bcrypt hash verification in authentication', () => {
  beforeEach(() => {
    __resetMockData()
  })

  it('should verify that same PIN works against its own hash', async () => {
    const pin = 'securepin123'
    const hash = await hashPin(pin)

    __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
      ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
      ['TEST123', 'Test Production', 'test-sheet-id', hash, hash, '2024-01-01']
    ])

    const event = createEvent({
      productionCode: 'TEST123',
      pin: pin
    })
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
  })

  it('should reject incorrect PIN even if similar', async () => {
    const correctPin = 'password123'
    const wrongPin = 'password124'
    const hash = await hashPin(correctPin)

    __setMockSheetData('test-registry-sheet-id', 'Registry!A:F', [
      ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
      ['TEST123', 'Test Production', 'test-sheet-id', hash, hash, '2024-01-01']
    ])

    const event = createEvent({
      productionCode: 'TEST123',
      pin: wrongPin
    })
    const response = await handler(event)

    expect(response.statusCode).toBe(401)
  })
})
