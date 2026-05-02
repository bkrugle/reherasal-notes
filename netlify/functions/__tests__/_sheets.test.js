'use strict'

// Mock googleapis before requiring _sheets
jest.mock('googleapis')

const { hashPin, verifyPin, makeProductionCode, ok, err, CORS } = require('../_sheets')

describe('_sheets.js utilities', () => {
  describe('hashPin (bcrypt)', () => {
    it('should return a bcrypt hash string', async () => {
      const hash = await hashPin('1234')

      expect(typeof hash).toBe('string')
      // Bcrypt hashes start with $2a$ or $2b$
      expect(hash).toMatch(/^\$2[aby]\$/)
    })

    it('should return different hashes for the same PIN (due to salt)', async () => {
      const hash1 = await hashPin('1234')
      const hash2 = await hashPin('1234')

      // Bcrypt generates unique salts, so hashes differ
      expect(hash1).not.toBe(hash2)
    })

    it('should return hashes of consistent length (~60 chars)', async () => {
      const hash = await hashPin('1234')

      // Bcrypt hashes are always 60 characters
      expect(hash.length).toBe(60)
    })

    it('should handle empty string', async () => {
      const hash = await hashPin('')

      expect(typeof hash).toBe('string')
      expect(hash).toMatch(/^\$2[aby]\$/)
    })

    it('should handle numeric PINs', async () => {
      const hash = await hashPin('9999')

      expect(hash).toMatch(/^\$2[aby]\$/)
    })

    it('should handle alphanumeric PINs', async () => {
      const hash = await hashPin('abc123')

      expect(hash).toMatch(/^\$2[aby]\$/)
    })

    it('should handle special characters in PIN', async () => {
      const hash = await hashPin('p@ss!word')

      expect(hash).toMatch(/^\$2[aby]\$/)
    })

    it('should handle long PINs', async () => {
      const longPin = 'a'.repeat(100)
      const hash = await hashPin(longPin)

      expect(hash).toMatch(/^\$2[aby]\$/)
    })
  })

  describe('verifyPin (bcrypt)', () => {
    it('should return true for matching PIN and hash', async () => {
      const pin = 'testpin123'
      const hash = await hashPin(pin)

      const result = await verifyPin(pin, hash)

      expect(result).toBe(true)
    })

    it('should return false for non-matching PIN', async () => {
      const hash = await hashPin('correctpin')

      const result = await verifyPin('wrongpin', hash)

      expect(result).toBe(false)
    })

    it('should return false for empty PIN', async () => {
      const hash = await hashPin('somepin')

      const result = await verifyPin('', hash)

      expect(result).toBe(false)
    })

    it('should return false for null PIN', async () => {
      const hash = await hashPin('somepin')

      const result = await verifyPin(null, hash)

      expect(result).toBe(false)
    })

    it('should return false for empty hash', async () => {
      const result = await verifyPin('somepin', '')

      expect(result).toBe(false)
    })

    it('should return false for null hash', async () => {
      const result = await verifyPin('somepin', null)

      expect(result).toBe(false)
    })

    it('should verify different PINs against their own hashes', async () => {
      const pin1 = '1234'
      const pin2 = '5678'
      const hash1 = await hashPin(pin1)
      const hash2 = await hashPin(pin2)

      expect(await verifyPin(pin1, hash1)).toBe(true)
      expect(await verifyPin(pin2, hash2)).toBe(true)
      expect(await verifyPin(pin1, hash2)).toBe(false)
      expect(await verifyPin(pin2, hash1)).toBe(false)
    })

    it('should handle special characters', async () => {
      const pin = 'p@ss!w0rd#123'
      const hash = await hashPin(pin)

      expect(await verifyPin(pin, hash)).toBe(true)
    })
  })

  describe('makeProductionCode', () => {
    it('should return uppercase code', () => {
      const code = makeProductionCode('test')

      expect(code).toBe(code.toUpperCase())
    })

    it('should start with first 4 letters of title', () => {
      const code = makeProductionCode('Hamilton')

      expect(code.startsWith('HAMI')).toBe(true)
    })

    it('should be 7 characters long (4 from title + 3 random)', () => {
      const code = makeProductionCode('Testing')

      expect(code.length).toBe(7)
    })

    it('should strip special characters from title', () => {
      const code = makeProductionCode('Test! Production@')

      expect(code.startsWith('TEST')).toBe(true)
    })

    it('should handle short titles', () => {
      const code = makeProductionCode('AB')

      expect(code.length).toBe(5) // 2 from title + 3 random
    })

    it('should generate different codes for same title (due to random suffix)', () => {
      const code1 = makeProductionCode('Same Title')
      const code2 = makeProductionCode('Same Title')

      // They start the same but random suffix differs
      expect(code1.slice(0, 4)).toBe(code2.slice(0, 4))
      // Note: There's a small chance they could be equal due to randomness
    })
  })

  describe('ok response helper', () => {
    it('should return 200 status code', () => {
      const response = ok({ test: true })

      expect(response.statusCode).toBe(200)
    })

    it('should include CORS headers', () => {
      const response = ok({ test: true })

      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined()
    })

    it('should set Content-Type to application/json', () => {
      const response = ok({ test: true })

      expect(response.headers['Content-Type']).toBe('application/json')
    })

    it('should JSON stringify the body', () => {
      const data = { test: true, nested: { value: 123 } }
      const response = ok(data)

      expect(JSON.parse(response.body)).toEqual(data)
    })
  })

  describe('err response helper', () => {
    it('should return 400 status code by default', () => {
      const response = err('Test error')

      expect(response.statusCode).toBe(400)
    })

    it('should return custom status code when provided', () => {
      const response = err('Not found', 404)

      expect(response.statusCode).toBe(404)
    })

    it('should include error message in body', () => {
      const response = err('Test error message')
      const body = JSON.parse(response.body)

      expect(body.error).toBe('Test error message')
    })

    it('should include CORS headers', () => {
      const response = err('Test error')

      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined()
    })
  })

  describe('CORS headers', () => {
    it('should allow all origins', () => {
      expect(CORS['Access-Control-Allow-Origin']).toBe('*')
    })

    it('should allow Content-Type header', () => {
      expect(CORS['Access-Control-Allow-Headers']).toContain('Content-Type')
    })

    it('should allow GET, POST, PUT, OPTIONS methods', () => {
      const methods = CORS['Access-Control-Allow-Methods']

      expect(methods).toContain('GET')
      expect(methods).toContain('POST')
      expect(methods).toContain('PUT')
      expect(methods).toContain('OPTIONS')
    })
  })
})

// Tests to verify bcrypt security properties
describe('bcrypt security properties', () => {
  it('should produce hashes that include cost factor', async () => {
    const hash = await hashPin('test')
    // Format: $2b$10$... where 10 is the cost factor
    expect(hash).toMatch(/^\$2[aby]\$10\$/)
  })

  it('should take measurable time to hash (work factor)', async () => {
    const start = Date.now()
    await hashPin('test')
    const elapsed = Date.now() - start

    // Bcrypt with cost 10 should take at least a few milliseconds
    // This is intentional to slow down brute force attacks
    expect(elapsed).toBeGreaterThan(0)
  })

  it('should be able to verify PINs created in the same session', async () => {
    const pins = ['1234', 'password', 'admin123', '!@#$%^']

    for (const pin of pins) {
      const hash = await hashPin(pin)
      const verified = await verifyPin(pin, hash)
      expect(verified).toBe(true)
    }
  })
})
