'use strict'

const { sheetsClient, getRows, hashPin, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { pin } = body
  if (!pin) return err('PIN required')

  // Load platform admins from env var
  // Format: [{"name":"Brian","pin":"xxxx"},{"name":"Jonathan","pin":"yyyy"}]
  let platformAdmins = []
  try {
    platformAdmins = JSON.parse(process.env.PLATFORM_ADMINS || '[]')
  } catch (e) {
    return err('Platform admins not configured', 500)
  }

  if (!platformAdmins.length) return err('No platform admins configured', 500)

  const pinHash = hashPin(pin)
  const admin = platformAdmins.find(a => hashPin(a.pin) === pinHash || a.pin === pin)

  if (!admin) return err('Invalid platform PIN', 401)

  return ok({
    platformAdmin: true,
    name: admin.name,
    role: 'platform'
  })
}
