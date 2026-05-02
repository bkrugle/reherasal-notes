'use strict'

// Note: getCorsHeaders is passed in to avoid circular dependency with _sheets.js

// =============================================================================
// SECURITY HEADERS
// =============================================================================

/**
 * Get security headers to include in all responses.
 * These headers help prevent common web vulnerabilities.
 * @returns {object} Security headers object
 */
function getSecurityHeaders() {
  return {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking by denying framing
    'X-Frame-Options': 'DENY',

    // Enable XSS filter in older browsers
    'X-XSS-Protection': '1; mode=block',

    // Force HTTPS for 1 year (31536000 seconds)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Content Security Policy for API responses
    // APIs return JSON, so we restrict everything
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",

    // Disable various browser features we don't need
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
  }
}

// =============================================================================
// ERROR MESSAGE SANITIZATION
// =============================================================================

// Patterns that indicate sensitive information
const SENSITIVE_PATTERNS = [
  // File paths (Unix)
  /\/(?:Users|home|var|etc|opt|tmp|root|srv|mnt)\/[^\s]+/gi,
  // File paths (Windows)
  /[A-Z]:\\(?:Users|Windows|Program Files)[^\s]*/gi,
  // Generic path patterns
  /(?:\/[a-zA-Z0-9_-]+){3,}/g,
  // Stack traces
  /\s+at\s+[^\n]+/g,
  // API keys (common formats)
  /(?:sk|pk|api|key|token|secret|password|credential)[_-]?[a-zA-Z0-9]{10,}/gi,
  // Google service account emails
  /[a-zA-Z0-9-]+@[a-zA-Z0-9-]+\.iam\.gserviceaccount\.com/gi,
  // Google project IDs in context
  /project[_-]?\d+/gi,
  // Spreadsheet IDs (44 char alphanumeric)
  /\b[a-zA-Z0-9_-]{40,50}\b/g,
  // IP addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g,
  // Connection strings
  /(?:mongodb|postgresql|mysql|redis|amqp|https?):\/\/[^\s]+/gi,
  // Private keys / certificates
  /-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g,
  // JSON with sensitive keys
  /"(?:private_key|password|secret|api_key|token)":\s*"[^"]+"/gi,
  // Environment variable names with values
  /(?:GOOGLE_|AWS_|API_|SECRET_|PASSWORD_|TOKEN_|KEY_)[A-Z_]+[=:][^\s]+/gi
]

// Safe error messages that should be preserved as-is
const SAFE_MESSAGES = [
  'Production not found',
  'Note not found',
  'Method not allowed',
  'Invalid JSON',
  'sheetId required',
  'Unauthorized',
  'Forbidden',
  'Rate limit exceeded',
  'Invalid request',
  'Not found'
]

/**
 * Sanitize error messages to prevent leaking sensitive information.
 * @param {string} message - The original error message
 * @returns {string} - Sanitized error message safe for client display
 */
function sanitizeErrorMessage(message) {
  // Handle null/undefined/empty
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return 'An error occurred'
  }

  // Check if it's a safe message that doesn't need sanitization
  for (const safe of SAFE_MESSAGES) {
    if (message.toLowerCase().includes(safe.toLowerCase())) {
      // Return just the safe part
      return safe
    }
  }

  let sanitized = message

  // Apply all sensitive pattern filters
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  // Remove any lines that are mostly redacted (stack traces)
  sanitized = sanitized
    .split('\n')
    .filter(line => {
      const redactedCount = (line.match(/\[REDACTED\]/g) || []).length
      return redactedCount < 2
    })
    .join(' ')
    .trim()

  // Clean up multiple spaces and redactions
  sanitized = sanitized
    .replace(/\s+/g, ' ')
    .replace(/(\[REDACTED\]\s*)+/g, '[REDACTED] ')
    .trim()

  // If message is empty or mostly redacted, provide generic error
  if (!sanitized || sanitized === '[REDACTED]' || sanitized.length < 5) {
    return 'An error occurred'
  }

  // Truncate long messages
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...'
  }

  return sanitized
}

// =============================================================================
// AUTHORIZATION VERIFICATION
// =============================================================================

/**
 * Extract Bearer token from request headers.
 * @param {object} event - Netlify function event object
 * @returns {string|null} - The token or null if not found/invalid
 */
function extractAuthToken(event) {
  const headers = event?.headers || {}

  // Check both capitalized and lowercase (Netlify normalizes to lowercase)
  const authHeader = headers.Authorization || headers.authorization

  if (!authHeader) return null

  // Must be Bearer token
  if (!authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()

  // Token must not be empty
  if (!token) return null

  return token
}

/**
 * Verify that a token has access to a specific sheet.
 * This is a lightweight check that validates the token format and
 * can be extended to check against stored session data.
 *
 * @param {string} sheetId - The Google Sheet ID to access
 * @param {string} token - The authorization token
 * @returns {Promise<{authorized: boolean, role: string|null}>}
 */
async function verifySheetAccess(sheetId, token) {
  // Fail fast for missing parameters
  if (!sheetId || !token) {
    return { authorized: false, role: null }
  }

  // Token format validation
  // Expected format: base64 encoded JSON with sheetId, role, expiry
  // For now, we do a basic format check
  // In production, this would verify against a session store or JWT

  try {
    // Token should be at least 20 chars (reasonable minimum for encoded data)
    if (token.length < 20) {
      return { authorized: false, role: null }
    }

    // Try to decode as base64 JSON
    let decoded
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    } catch {
      // Not valid base64 JSON - could be a different format
      // For backward compatibility, accept tokens that match a simple pattern
      if (/^[A-Za-z0-9_-]+$/.test(token)) {
        // Legacy token format - allow but with limited role
        return { authorized: true, role: 'member' }
      }
      return { authorized: false, role: null }
    }

    // Verify the token contains expected fields
    if (!decoded.sheetId || !decoded.role) {
      return { authorized: false, role: null }
    }

    // Verify sheetId matches
    if (decoded.sheetId !== sheetId) {
      return { authorized: false, role: null }
    }

    // Check expiry if present
    if (decoded.exp && Date.now() > decoded.exp) {
      return { authorized: false, role: null }
    }

    return { authorized: true, role: decoded.role }
  } catch {
    return { authorized: false, role: null }
  }
}

// =============================================================================
// SECURE RESPONSE HELPERS
// =============================================================================

/**
 * Create a success response with both CORS and security headers.
 * @param {any} body - Response body (will be JSON stringified)
 * @param {object} [corsHeaders] - CORS headers from getCorsHeaders()
 * @returns {object} - Netlify function response object
 */
function secureOk(body, corsHeaders = {}) {
  const securityHeaders = getSecurityHeaders()

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

/**
 * Create an error response with sanitized message and security headers.
 * @param {string} msg - Error message (will be sanitized)
 * @param {number} [code=400] - HTTP status code
 * @param {object} [corsHeaders] - CORS headers from getCorsHeaders()
 * @returns {object} - Netlify function response object
 */
function secureErr(msg, code = 400, corsHeaders = {}) {
  const securityHeaders = getSecurityHeaders()
  const sanitizedMessage = sanitizeErrorMessage(msg)

  return {
    statusCode: code,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ error: sanitizedMessage })
  }
}

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Create a simple in-memory rate limiter.
 * Note: This resets when the function cold starts. For production,
 * consider using Redis or a distributed rate limiter.
 *
 * @param {object} options - Rate limiter options
 * @param {number} options.max - Maximum requests per window
 * @param {number} options.windowMs - Window size in milliseconds
 * @returns {object} - Rate limiter with check(ip) method
 */
function createRateLimiter({ max = 10, windowMs = 60000 } = {}) {
  const store = new Map()

  return {
    /**
     * Check if a request should be allowed.
     * @param {string} identifier - Usually IP address or user ID
     * @returns {boolean} - True if request is allowed
     */
    check(identifier) {
      const now = Date.now()
      const key = identifier || 'unknown'

      const entry = store.get(key)

      // First request or window expired
      if (!entry || now - entry.start > windowMs) {
        store.set(key, { count: 1, start: now })
        return true
      }

      // Increment and check
      entry.count++
      store.set(key, entry)

      return entry.count <= max
    },

    /**
     * Reset rate limit for an identifier.
     * @param {string} identifier - The identifier to reset
     */
    reset(identifier) {
      store.delete(identifier)
    },

    /**
     * Clear all rate limit data.
     */
    clear() {
      store.clear()
    }
  }
}

module.exports = {
  // Security headers
  getSecurityHeaders,

  // Error sanitization
  sanitizeErrorMessage,

  // Authorization
  extractAuthToken,
  verifySheetAccess,

  // Secure response helpers
  secureOk,
  secureErr,

  // Rate limiting
  createRateLimiter
}
