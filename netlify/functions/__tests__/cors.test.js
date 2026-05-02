'use strict'

// Mock googleapis before requiring _sheets
jest.mock('googleapis')

// We'll test the CORS functionality after implementation
// For now, let's define what the behavior should be

describe('CORS configuration', () => {
  let getCorsHeaders, ALLOWED_ORIGINS

  beforeEach(() => {
    // Clear module cache to get fresh imports with updated env vars
    jest.resetModules()

    // Set up test environment
    process.env.ALLOWED_ORIGINS = 'https://myapp.netlify.app,https://example.com'
  })

  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS
  })

  describe('getCorsHeaders', () => {
    beforeEach(() => {
      const sheets = require('../_sheets')
      getCorsHeaders = sheets.getCorsHeaders
      ALLOWED_ORIGINS = sheets.ALLOWED_ORIGINS
    })

    it('should return allowed origin when request origin is in allowlist', () => {
      const headers = getCorsHeaders('https://myapp.netlify.app')

      expect(headers['Access-Control-Allow-Origin']).toBe('https://myapp.netlify.app')
    })

    it('should return allowed origin for second domain in allowlist', () => {
      const headers = getCorsHeaders('https://example.com')

      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com')
    })

    it('should return first allowed origin when request origin is not in allowlist', () => {
      const headers = getCorsHeaders('https://malicious-site.com')

      // Should default to first allowed origin, not the malicious one
      expect(headers['Access-Control-Allow-Origin']).not.toBe('https://malicious-site.com')
      expect(ALLOWED_ORIGINS).toContain(headers['Access-Control-Allow-Origin'])
    })

    it('should return first allowed origin when no origin provided', () => {
      const headers = getCorsHeaders(null)

      expect(ALLOWED_ORIGINS).toContain(headers['Access-Control-Allow-Origin'])
    })

    it('should return first allowed origin for undefined origin', () => {
      const headers = getCorsHeaders(undefined)

      expect(ALLOWED_ORIGINS).toContain(headers['Access-Control-Allow-Origin'])
    })

    it('should include Vary: Origin header for caching', () => {
      const headers = getCorsHeaders('https://myapp.netlify.app')

      expect(headers['Vary']).toBe('Origin')
    })

    it('should allow Content-Type header', () => {
      const headers = getCorsHeaders('https://myapp.netlify.app')

      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type')
    })

    it('should allow required HTTP methods', () => {
      const headers = getCorsHeaders('https://myapp.netlify.app')
      const methods = headers['Access-Control-Allow-Methods']

      expect(methods).toContain('GET')
      expect(methods).toContain('POST')
      expect(methods).toContain('PUT')
      expect(methods).toContain('DELETE')
      expect(methods).toContain('OPTIONS')
    })
  })

  describe('localhost handling in development', () => {
    beforeEach(() => {
      jest.resetModules()
      process.env.ALLOWED_ORIGINS = 'https://myapp.netlify.app'
      process.env.CONTEXT = 'dev'
    })

    afterEach(() => {
      delete process.env.CONTEXT
    })

    it('should allow localhost in dev context', () => {
      const { getCorsHeaders } = require('../_sheets')
      const headers = getCorsHeaders('http://localhost:5173')

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
    })

    it('should allow localhost:3000 in dev context', () => {
      const { getCorsHeaders } = require('../_sheets')
      const headers = getCorsHeaders('http://localhost:3000')

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000')
    })
  })

  describe('ok() and err() helpers with CORS', () => {
    it('should include CORS headers in ok() response', () => {
      const { ok } = require('../_sheets')
      const response = ok({ test: true }, 'https://myapp.netlify.app')

      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined()
      expect(response.headers['Vary']).toBe('Origin')
    })

    it('should include CORS headers in err() response', () => {
      const { err } = require('../_sheets')
      const response = err('Error message', 400, 'https://myapp.netlify.app')

      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined()
      expect(response.headers['Vary']).toBe('Origin')
    })

    it('should use correct origin in ok() when origin is allowed', () => {
      const { ok } = require('../_sheets')
      const response = ok({ test: true }, 'https://myapp.netlify.app')

      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://myapp.netlify.app')
    })

    it('should fallback to default origin in ok() when origin is not allowed', () => {
      const { ok, ALLOWED_ORIGINS } = require('../_sheets')
      const response = ok({ test: true }, 'https://evil.com')

      expect(response.headers['Access-Control-Allow-Origin']).not.toBe('https://evil.com')
      expect(ALLOWED_ORIGINS).toContain(response.headers['Access-Control-Allow-Origin'])
    })
  })

  describe('ALLOWED_ORIGINS configuration', () => {
    it('should parse origins from environment variable', () => {
      jest.resetModules()
      process.env.ALLOWED_ORIGINS = 'https://app1.com,https://app2.com,https://app3.com'

      const { ALLOWED_ORIGINS } = require('../_sheets')

      expect(ALLOWED_ORIGINS).toContain('https://app1.com')
      expect(ALLOWED_ORIGINS).toContain('https://app2.com')
      expect(ALLOWED_ORIGINS).toContain('https://app3.com')
    })

    it('should handle single origin in environment variable', () => {
      jest.resetModules()
      process.env.ALLOWED_ORIGINS = 'https://single-app.com'

      const { ALLOWED_ORIGINS } = require('../_sheets')

      expect(ALLOWED_ORIGINS).toContain('https://single-app.com')
    })

    it('should have fallback origins when env var is not set', () => {
      jest.resetModules()
      delete process.env.ALLOWED_ORIGINS

      const { ALLOWED_ORIGINS } = require('../_sheets')

      // Should have at least one default origin
      expect(ALLOWED_ORIGINS.length).toBeGreaterThan(0)
    })
  })
})

describe('CORS integration with authenticate endpoint', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.ALLOWED_ORIGINS = 'https://myapp.netlify.app'

    const { __resetMockData } = require('googleapis')
    __resetMockData()
  })

  it('should return correct CORS headers on OPTIONS preflight', async () => {
    const { handler } = require('../authenticate')

    const event = {
      httpMethod: 'OPTIONS',
      headers: {
        origin: 'https://myapp.netlify.app'
      }
    }

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://myapp.netlify.app')
    expect(response.headers['Vary']).toBe('Origin')
  })

  it('should reject disallowed origin in preflight', async () => {
    const { handler } = require('../authenticate')
    const { ALLOWED_ORIGINS } = require('../_sheets')

    const event = {
      httpMethod: 'OPTIONS',
      headers: {
        origin: 'https://malicious-site.com'
      }
    }

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    // Should not return the malicious origin
    expect(response.headers['Access-Control-Allow-Origin']).not.toBe('https://malicious-site.com')
    expect(ALLOWED_ORIGINS).toContain(response.headers['Access-Control-Allow-Origin'])
  })
})
