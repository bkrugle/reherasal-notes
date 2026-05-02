'use strict'

const { google } = require('googleapis')
const bcrypt = require('bcryptjs')

// Number of salt rounds for bcrypt (10 is a good balance of security and speed)
const BCRYPT_SALT_ROUNDS = 10

const REGISTRY_SHEET_ID = process.env.REGISTRY_SHEET_ID

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set')
  let creds
  try {
    creds = JSON.parse(json)
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ' + e.message)
  }
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
  })
}

async function sheetsClient() {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
}

async function driveClient() {
  const auth = getAuth()
  return google.drive({ version: 'v3', auth })
}

async function getRows(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return res.data.values || []
}

async function appendRows(sheets, spreadsheetId, range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  })
}

async function updateRow(sheets, spreadsheetId, sheetName, rowIndex, values) {
  const range = `${sheetName}!A${rowIndex}:Z${rowIndex}`
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [values] }
  })
}

/**
 * Hash a PIN using bcrypt (async)
 * @param {string} pin - The PIN to hash
 * @returns {Promise<string>} - The bcrypt hash
 */
async function hashPin(pin) {
  return bcrypt.hash(pin, BCRYPT_SALT_ROUNDS)
}

/**
 * Verify a PIN against a bcrypt hash (async)
 * @param {string} pin - The PIN to verify
 * @param {string} hash - The bcrypt hash to compare against
 * @returns {Promise<boolean>} - True if PIN matches hash
 */
async function verifyPin(pin, hash) {
  // Handle empty/null values
  if (!pin || !hash) return false
  return bcrypt.compare(pin, hash)
}

// =============================================================================
// MIGRATION CODE - Uncomment if you need to support gradual migration from
// legacy DJB2 hashes to bcrypt. This allows existing users to log in with
// their old hashes and automatically upgrades them to bcrypt.
// =============================================================================

// /**
//  * Legacy DJB2 hash function (NOT SECURE - for migration only)
//  * @param {string} pin - The PIN to hash
//  * @returns {string} - The DJB2 hash (base36)
//  */
// function legacyHashPin(pin) {
//   let hash = 5381
//   for (let i = 0; i < pin.length; i++) {
//     hash = ((hash << 5) + hash) + pin.charCodeAt(i)
//     hash = hash & hash
//   }
//   return Math.abs(hash).toString(36)
// }
//
// /**
//  * Check if a hash is a legacy DJB2 hash (not bcrypt)
//  * Bcrypt hashes start with $2a$, $2b$, or $2y$
//  * @param {string} hash - The hash to check
//  * @returns {boolean} - True if this is a legacy hash
//  */
// function isLegacyHash(hash) {
//   if (!hash) return false
//   return !hash.startsWith('$2')
// }
//
// /**
//  * Verify PIN with migration support - checks bcrypt first, falls back to legacy
//  * @param {string} pin - The PIN to verify
//  * @param {string} storedHash - The stored hash (bcrypt or legacy)
//  * @param {Function} updateCallback - Async callback to update hash: (newBcryptHash) => Promise
//  * @returns {Promise<boolean>} - True if PIN is valid
//  */
// async function verifyPinWithMigration(pin, storedHash, updateCallback) {
//   if (!pin || !storedHash) return false
//
//   // If it's a bcrypt hash, use normal verification
//   if (!isLegacyHash(storedHash)) {
//     return bcrypt.compare(pin, storedHash)
//   }
//
//   // Legacy hash - check with DJB2
//   const legacyHash = legacyHashPin(pin)
//   if (legacyHash !== storedHash) {
//     return false
//   }
//
//   // PIN is valid with legacy hash - migrate to bcrypt
//   if (updateCallback) {
//     try {
//       const newHash = await hashPin(pin)
//       await updateCallback(newHash)
//       console.log('Successfully migrated PIN hash to bcrypt')
//     } catch (e) {
//       console.error('Failed to migrate PIN hash:', e.message)
//       // Still return true since the PIN was valid
//     }
//   }
//
//   return true
// }
//
// module.exports = {
//   // ... existing exports ...
//   legacyHashPin, isLegacyHash, verifyPinWithMigration
// }

// =============================================================================
// END MIGRATION CODE
// =============================================================================

function makeProductionCode(title) {
  const slug = title.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return slug + rand
}

// =============================================================================
// CORS CONFIGURATION
// Set ALLOWED_ORIGINS env var to a comma-separated list of allowed origins
// Example: ALLOWED_ORIGINS=https://myapp.netlify.app,https://myapp.com
// =============================================================================

// Parse allowed origins from environment variable
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

// Add localhost origins in development/preview contexts
const isDev = process.env.CONTEXT === 'dev' ||
              process.env.CONTEXT === 'deploy-preview' ||
              process.env.NODE_ENV === 'development'

if (isDev) {
  if (!ALLOWED_ORIGINS.includes('http://localhost:5173')) {
    ALLOWED_ORIGINS.push('http://localhost:5173')
  }
  if (!ALLOWED_ORIGINS.includes('http://localhost:3000')) {
    ALLOWED_ORIGINS.push('http://localhost:3000')
  }
}

// Fallback if no origins configured (should be configured in production!)
if (ALLOWED_ORIGINS.length === 0) {
  console.warn('WARNING: ALLOWED_ORIGINS not configured. Using fallback. Set ALLOWED_ORIGINS env var in production.')
  ALLOWED_ORIGINS.push('https://localhost')
}

/**
 * Get CORS headers for a given request origin
 * @param {string} requestOrigin - The Origin header from the request
 * @returns {object} - CORS headers object
 */
function getCorsHeaders(requestOrigin) {
  // Check if the request origin is in our allowlist
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0] // Default to first allowed origin

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Platform-Pin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin' // Important for proper caching
  }
}

// Legacy CORS constant for backward compatibility (uses first allowed origin)
// Prefer using getCorsHeaders(origin) for proper origin handling
const CORS = getCorsHeaders(ALLOWED_ORIGINS[0])

/**
 * Create a success response with CORS headers
 * @param {any} body - Response body (will be JSON stringified)
 * @param {string} [origin] - Request origin for CORS (optional, uses default if not provided)
 * @returns {object} - Netlify function response object
 */
function ok(body, origin) {
  const corsHeaders = origin ? getCorsHeaders(origin) : CORS
  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

/**
 * Create an error response with CORS headers
 * @param {string} msg - Error message
 * @param {number} [code=400] - HTTP status code
 * @param {string} [origin] - Request origin for CORS (optional, uses default if not provided)
 * @returns {object} - Netlify function response object
 */
function err(msg, code = 400, origin) {
  const corsHeaders = origin ? getCorsHeaders(origin) : CORS
  return {
    statusCode: code,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: msg })
  }
}

module.exports = {
  getAuth, sheetsClient, driveClient, getRows, appendRows, updateRow,
  hashPin, verifyPin, makeProductionCode,
  CORS, getCorsHeaders, ALLOWED_ORIGINS, ok, err,
  REGISTRY_SHEET_ID
}
