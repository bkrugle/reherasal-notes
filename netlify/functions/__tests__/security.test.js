'use strict'

/**
 * Security tests for:
 * 1. Authorization verification
 * 2. Error message sanitization
 * 3. Security headers
 */

describe('Security Features', () => {
  let security

  beforeAll(() => {
    try {
      security = require('../_security')
    } catch (e) {
      security = null
    }
  })

  // =========================================================================
  // SECURITY HEADERS
  // =========================================================================
  describe('Security Headers', () => {
    test('should export getSecurityHeaders function', () => {
      expect(security).not.toBeNull()
      expect(typeof security.getSecurityHeaders).toBe('function')
    })

    test('should include X-Content-Type-Options header', () => {
      const headers = security.getSecurityHeaders()
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
    })

    test('should include X-Frame-Options header', () => {
      const headers = security.getSecurityHeaders()
      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    test('should include X-XSS-Protection header', () => {
      const headers = security.getSecurityHeaders()
      expect(headers['X-XSS-Protection']).toBe('1; mode=block')
    })

    test('should include Strict-Transport-Security header', () => {
      const headers = security.getSecurityHeaders()
      expect(headers['Strict-Transport-Security']).toContain('max-age=')
    })

    test('should include Referrer-Policy header', () => {
      const headers = security.getSecurityHeaders()
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    })

    test('should include Content-Security-Policy header', () => {
      const headers = security.getSecurityHeaders()
      expect(headers['Content-Security-Policy']).toBeDefined()
      expect(headers['Content-Security-Policy']).toContain("default-src")
    })

    test('should include Permissions-Policy header', () => {
      const headers = security.getSecurityHeaders()
      expect(headers['Permissions-Policy']).toBeDefined()
    })
  })

  // =========================================================================
  // ERROR MESSAGE SANITIZATION
  // =========================================================================
  describe('Error Message Sanitization', () => {
    test('should export sanitizeErrorMessage function', () => {
      expect(security).not.toBeNull()
      expect(typeof security.sanitizeErrorMessage).toBe('function')
    })

    test('should strip file paths from error messages', () => {
      const error = 'Error at /Users/admin/secrets/app/src/file.js:42'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('/Users')
      expect(sanitized).not.toContain('/admin')
      expect(sanitized).not.toContain('/secrets')
    })

    test('should strip Windows paths from error messages', () => {
      const error = 'Error at C:\\Users\\admin\\secrets\\app\\file.js'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('C:\\')
      expect(sanitized).not.toContain('\\Users')
    })

    test('should strip API keys from error messages', () => {
      const error = 'API Error: Invalid key sk-1234567890abcdefghijklmnop'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('sk-1234567890')
    })

    test('should strip Google credentials from error messages', () => {
      const error = 'Auth failed for service-account@project-12345.iam.gserviceaccount.com'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('gserviceaccount.com')
      expect(sanitized).not.toContain('project-12345')
    })

    test('should strip spreadsheet IDs from error messages', () => {
      const error = 'Cannot access spreadsheet 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')
    })

    test('should strip stack traces from error messages', () => {
      const error = 'Error: Something failed\n    at Function.handler (/var/task/handler.js:15:23)\n    at Runtime.exports.handler'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('at Function.handler')
      expect(sanitized).not.toContain('/var/task')
    })

    test('should strip environment variable values from error messages', () => {
      const error = 'Invalid JSON in GOOGLE_SERVICE_ACCOUNT_JSON: {"private_key":"-----BEGIN PRIVATE KEY-----"}'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('private_key')
      expect(sanitized).not.toContain('BEGIN PRIVATE KEY')
    })

    test('should preserve safe error messages', () => {
      const error = 'Production not found'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).toBe('Production not found')
    })

    test('should provide generic message for completely sensitive errors', () => {
      const error = '/Users/admin/secrets/config.json: ENOENT'
      const sanitized = security.sanitizeErrorMessage(error)
      // Should return generic error if message would be empty after stripping
      expect(sanitized.length).toBeGreaterThan(0)
      expect(sanitized).not.toContain('/Users')
    })

    test('should handle null/undefined gracefully', () => {
      expect(security.sanitizeErrorMessage(null)).toBe('An error occurred')
      expect(security.sanitizeErrorMessage(undefined)).toBe('An error occurred')
      expect(security.sanitizeErrorMessage('')).toBe('An error occurred')
    })

    test('should truncate overly long error messages', () => {
      const longError = 'Error: ' + 'a'.repeat(1000)
      const sanitized = security.sanitizeErrorMessage(longError)
      expect(sanitized.length).toBeLessThanOrEqual(200)
    })

    test('should strip IP addresses from error messages', () => {
      const error = 'Connection refused by 192.168.1.100:5432'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('192.168.1.100')
    })

    test('should strip connection strings from error messages', () => {
      const error = 'Failed to connect: mongodb://user:password@host:27017/database'
      const sanitized = security.sanitizeErrorMessage(error)
      expect(sanitized).not.toContain('mongodb://')
      expect(sanitized).not.toContain('password')
    })
  })

  // =========================================================================
  // AUTHORIZATION VERIFICATION
  // =========================================================================
  describe('Authorization Verification', () => {
    test('should export verifySheetAccess function', () => {
      expect(security).not.toBeNull()
      expect(typeof security.verifySheetAccess).toBe('function')
    })

    test('should export extractAuthToken function', () => {
      expect(security).not.toBeNull()
      expect(typeof security.extractAuthToken).toBe('function')
    })

    describe('extractAuthToken', () => {
      test('should extract Bearer token from Authorization header', () => {
        const event = {
          headers: { Authorization: 'Bearer abc123token' }
        }
        const token = security.extractAuthToken(event)
        expect(token).toBe('abc123token')
      })

      test('should handle lowercase authorization header', () => {
        const event = {
          headers: { authorization: 'Bearer xyz789token' }
        }
        const token = security.extractAuthToken(event)
        expect(token).toBe('xyz789token')
      })

      test('should return null for missing Authorization header', () => {
        const event = { headers: {} }
        const token = security.extractAuthToken(event)
        expect(token).toBeNull()
      })

      test('should return null for non-Bearer auth', () => {
        const event = {
          headers: { Authorization: 'Basic abc123' }
        }
        const token = security.extractAuthToken(event)
        expect(token).toBeNull()
      })

      test('should return null for malformed Bearer token', () => {
        const event = {
          headers: { Authorization: 'Bearer' }
        }
        const token = security.extractAuthToken(event)
        expect(token).toBeNull()
      })
    })

    describe('verifySheetAccess', () => {
      test('should return false for null/undefined sheetId', async () => {
        const result = await security.verifySheetAccess(null, 'sometoken')
        expect(result.authorized).toBe(false)
      })

      test('should return false for null/undefined token', async () => {
        const result = await security.verifySheetAccess('sheetId', null)
        expect(result.authorized).toBe(false)
      })

      test('should return false for invalid token format', async () => {
        const result = await security.verifySheetAccess('sheetId', 'invalidtoken')
        expect(result.authorized).toBe(false)
      })

      test('should include role in result when authorized', async () => {
        // This test would need mocking in a real scenario
        // For now, test the structure
        const result = await security.verifySheetAccess('sheetId', null)
        expect(result).toHaveProperty('authorized')
        expect(result).toHaveProperty('role')
      })
    })
  })

  // =========================================================================
  // SECURE RESPONSE HELPERS
  // =========================================================================
  describe('Secure Response Helpers', () => {
    test('should export secureOk function', () => {
      expect(security).not.toBeNull()
      expect(typeof security.secureOk).toBe('function')
    })

    test('should export secureErr function', () => {
      expect(security).not.toBeNull()
      expect(typeof security.secureErr).toBe('function')
    })

    test('secureOk should include security headers', () => {
      const response = security.secureOk({ data: 'test' })
      expect(response.headers['X-Content-Type-Options']).toBe('nosniff')
      expect(response.headers['X-Frame-Options']).toBe('DENY')
    })

    test('secureOk should include CORS headers when provided', () => {
      const corsHeaders = { 'Access-Control-Allow-Origin': 'https://example.com' }
      const response = security.secureOk({ data: 'test' }, corsHeaders)
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://example.com')
    })

    test('secureErr should sanitize error messages', () => {
      const response = security.secureErr('Error at /Users/admin/file.js', 500)
      const body = JSON.parse(response.body)
      expect(body.error).not.toContain('/Users/admin')
    })

    test('secureErr should include security headers', () => {
      const response = security.secureErr('Error', 500)
      expect(response.headers['X-Content-Type-Options']).toBe('nosniff')
      expect(response.headers['X-Frame-Options']).toBe('DENY')
    })

    test('secureErr should have correct status code', () => {
      const response = security.secureErr('Not found', 404)
      expect(response.statusCode).toBe(404)
    })
  })

  // =========================================================================
  // RATE LIMITING HELPERS (Optional enhancement)
  // =========================================================================
  describe('Rate Limiting', () => {
    test('should export createRateLimiter function', () => {
      expect(security).not.toBeNull()
      expect(typeof security.createRateLimiter).toBe('function')
    })

    test('should allow requests within limit', () => {
      const limiter = security.createRateLimiter({ max: 5, windowMs: 60000 })
      expect(limiter.check('ip1')).toBe(true)
      expect(limiter.check('ip1')).toBe(true)
      expect(limiter.check('ip1')).toBe(true)
    })

    test('should block requests exceeding limit', () => {
      const limiter = security.createRateLimiter({ max: 2, windowMs: 60000 })
      expect(limiter.check('ip2')).toBe(true)
      expect(limiter.check('ip2')).toBe(true)
      expect(limiter.check('ip2')).toBe(false) // Exceeds limit
    })

    test('should track different IPs separately', () => {
      const limiter = security.createRateLimiter({ max: 1, windowMs: 60000 })
      expect(limiter.check('ipA')).toBe(true)
      expect(limiter.check('ipB')).toBe(true) // Different IP
      expect(limiter.check('ipA')).toBe(false) // Same IP, exceeds
    })
  })
})

// =========================================================================
// INTEGRATION TESTS - Updated helpers in _sheets.js
// =========================================================================
describe('Updated _sheets.js with security', () => {
  let sheets

  beforeAll(() => {
    // Set up env for tests
    process.env.ALLOWED_ORIGINS = 'https://test.com,https://example.com'
    // Clear the module cache to pick up new env
    jest.resetModules()
    sheets = require('../_sheets')
  })

  test('ok() should include security headers when using secureOk', () => {
    // This tests that the existing ok/err can be enhanced
    const response = sheets.ok({ test: true })
    expect(response.statusCode).toBe(200)
    expect(response.headers['Content-Type']).toBe('application/json')
  })

  test('err() should not leak sensitive info', () => {
    const response = sheets.err('Failed: something went wrong', 500)
    const body = JSON.parse(response.body)
    expect(body.error).toBeDefined()
    // Current err() doesn't sanitize, but after implementation it should
  })
})
