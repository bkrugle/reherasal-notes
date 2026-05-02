'use strict'

const { verifyPin, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { pin } = body
  if (!pin) return err('PIN required', 400, origin)

  // Load platform admins from env var
  // Format: [{"name":"Brian","pin":"xxxx"},{"name":"Jonathan","pin":"yyyy"}]
  let platformAdmins = []
  try {
    platformAdmins = JSON.parse(process.env.PLATFORM_ADMINS || '[]')
  } catch (e) {
    return err('Platform admins not configured', 500, origin)
  }

  if (!platformAdmins.length) return err('No platform admins configured', 500, origin)

  // Find admin by verifying PIN against stored bcrypt hash
  // Platform admins should have bcrypt hashes stored in PLATFORM_ADMINS env var
  let admin = null
  for (const a of platformAdmins) {
    if (await verifyPin(pin, a.pin)) {
      admin = a
      break
    }
  }

  if (!admin) return err('Invalid platform PIN', 401, origin)

  return ok({
    platformAdmin: true,
    name: admin.name,
    role: 'platform'
  }, origin)
}
