'use strict'

/**
 * Input validation and sanitization for dual-backend support:
 * - Google Sheets (current): CSV/formula injection protection
 * - DocumentDB (future): NoSQL injection protection
 */

// Characters that trigger formula evaluation in spreadsheets
const FORMULA_CHARS = ['=', '+', '-', '@']

// DocumentDB/MongoDB operator prefix
const DOCDB_OPERATOR_PREFIX = '$'

/**
 * Sanitize input for safe storage in Google Sheets.
 * Prevents CSV/formula injection attacks.
 *
 * @param {any} input - The value to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeForSheets(input) {
  if (input === null || input === undefined) return ''
  const str = String(input)
  if (str === '') return ''

  let result = str

  // Escape leading formula characters by prefixing with single quote
  // This is the standard defense against CSV injection
  if (FORMULA_CHARS.some(char => result.startsWith(char))) {
    result = "'" + result
  }

  // Remove or escape control characters that could cause issues
  // Tab characters can break CSV structure
  result = result.replace(/\t/g, ' ')
  // Carriage returns can break row structure
  result = result.replace(/\r/g, '')

  return result
}

/**
 * Sanitize input for safe storage in DocumentDB/MongoDB.
 * Prevents NoSQL injection attacks.
 *
 * @param {any} input - The value to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeForDocDB(input) {
  if (input === null || input === undefined) return ''
  const str = String(input)
  if (str === '') return ''

  let result = str

  // Remove null bytes (can cause string truncation issues)
  result = result.replace(/\0/g, '')

  // Escape leading $ (MongoDB operator prefix) by removing it
  // This prevents $gt, $ne, $where, etc. injection
  if (result.startsWith(DOCDB_OPERATOR_PREFIX)) {
    result = result.slice(1)
  }

  // Replace dots ONLY in strings that look like field paths:
  // - No spaces (field paths don't have spaces)
  // - Contains only alphanumeric, dots, underscores
  // This prevents nested field access like "user.password" while preserving
  // normal sentences like "This is a note. Great job!"
  if (/^[a-zA-Z0-9_.]+$/.test(result) && result.includes('.')) {
    result = result.replace(/\./g, '\u2024')
  }

  // Handle curly braces combined with $ operators (object injection)
  // If string contains both { and $, strip the dangerous combo
  if (result.includes('{') && result.includes('$')) {
    result = result.replace(/\$/g, '').replace(/[{}]/g, '')
  }

  return result
}

/**
 * Combined sanitization for both Sheets and DocumentDB backends.
 * Use this for text fields that need protection for both storage systems.
 *
 * @param {any} input - The value to sanitize
 * @returns {string} - Sanitized string safe for both backends
 */
function sanitizeInput(input) {
  if (input === null || input === undefined) return ''
  const str = String(input)
  if (str === '') return ''

  // Apply both sanitization strategies
  let result = str

  // DocumentDB protection first (removes dangerous chars)
  result = sanitizeForDocDB(result)

  // Then Sheets protection (prefixes if needed)
  result = sanitizeForSheets(result)

  return result
}

/**
 * Validate a production code.
 * Must be alphanumeric with dashes/underscores, 3-64 chars.
 *
 * @param {any} code - The production code to validate
 * @returns {boolean} - True if valid
 */
function validateProductionCode(code) {
  if (code === null || code === undefined || code === '') return false
  const str = String(code)

  // Length check: 3-64 characters
  if (str.length < 3 || str.length > 64) return false

  // Alphanumeric with dashes and underscores only
  return /^[a-zA-Z0-9_-]+$/.test(str)
}

/**
 * Validate a PIN.
 * Must be 4-8 numeric digits.
 *
 * @param {any} pin - The PIN to validate
 * @returns {boolean} - True if valid
 */
function validatePin(pin) {
  if (pin === null || pin === undefined || pin === '') return false
  const str = String(pin)

  // Must be 4-8 digits only
  return /^[0-9]{4,8}$/.test(str)
}

/**
 * Validate an email address.
 * Returns true for valid emails or empty (optional field).
 *
 * @param {any} email - The email to validate
 * @returns {boolean} - True if valid or empty
 */
function validateEmail(email) {
  // Empty is OK (optional field)
  if (email === null || email === undefined || email === '') return true

  const str = String(email)

  // Check for header injection attempts (newlines)
  if (/[\r\n]/.test(str)) return false

  // Basic email format validation
  // Intentionally simple - we're validating format, not deliverability
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
}

/**
 * Validate a phone number.
 * Accepts various formats, returns true for valid or empty.
 *
 * @param {any} phone - The phone number to validate
 * @returns {boolean} - True if valid or empty
 */
function validatePhone(phone) {
  // Empty is OK (optional field)
  if (phone === null || phone === undefined || phone === '') return true

  const str = String(phone)

  // Check for dangerous characters (newlines, semicolons, etc.)
  if (/[\r\n;`$]/.test(str)) return false

  // Must contain at least 7 digits (basic phone number)
  const digits = str.replace(/\D/g, '')
  if (digits.length < 7) return false

  // Only allow expected phone number characters
  return /^[0-9()+\-.\s]+$/.test(str)
}

/**
 * Validate a Google Sheet ID.
 * Must be alphanumeric with dashes and underscores.
 *
 * @param {any} sheetId - The sheet ID to validate
 * @returns {boolean} - True if valid
 */
function validateSheetId(sheetId) {
  if (sheetId === null || sheetId === undefined || sheetId === '') return false
  const str = String(sheetId)

  // Google Sheet IDs are alphanumeric with dashes and underscores
  // Typical length is 44 characters but can vary
  return /^[a-zA-Z0-9_-]+$/.test(str) && str.length >= 10
}

/**
 * Recursively sanitize all string values in an object.
 *
 * @param {any} obj - The object to sanitize
 * @returns {object} - Sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return {}
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') return sanitizeInput(item)
      if (typeof item === 'object' && item !== null) return sanitizeObject(item)
      return item
    })
  }

  const result = {}
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value)
    } else if (Array.isArray(value)) {
      result[key] = sanitizeObject(value)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value)
    } else {
      result[key] = value
    }
  }
  return result
}

module.exports = {
  sanitizeForSheets,
  sanitizeForDocDB,
  sanitizeInput,
  validateProductionCode,
  validatePin,
  validateEmail,
  validatePhone,
  validateSheetId,
  sanitizeObject
}
