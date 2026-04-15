'use strict'

const { sheetsClient, getRows, hashPin, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { platformPin, productionCode } = body
  if (!platformPin || !productionCode) return err('platformPin and productionCode required')

  // Verify platform admin
  let platformAdmins = []
  try { platformAdmins = JSON.parse(process.env.PLATFORM_ADMINS || '[]') } catch {}
  const admin = platformAdmins.find(a => a.pin === platformPin || hashPin(a.pin) === hashPin(platformPin))
  if (!admin) return err('Invalid platform PIN', 401)

  try {
    const sheets = await sheetsClient()
    const rows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (rows.length < 2) return err('Production not found', 404)

    const [header, ...data] = rows
    const codeIdx = header.indexOf('productionCode')
    const titleIdx = header.indexOf('title')
    const sheetIdx = header.indexOf('sheetId')

    const row = data.find(r => r[codeIdx] === productionCode.toUpperCase())
    if (!row) return err('Production not found', 404)

    const sheetId = row[sheetIdx]

    // Get director info
    let directorName = admin.name + ' (Platform)'
    let directorEmail = ''
    try {
      const configRows = await getRows(sheets, sheetId, 'Config!A:B')
      const config = {}
      configRows.forEach(([k, v]) => { if (k) config[k] = v })
      directorEmail = config.directorEmail || ''
    } catch {}

    return ok({
      productionCode: productionCode.toUpperCase(),
      title: row[titleIdx],
      sheetId,
      role: 'admin',
      name: directorName,
      email: directorEmail,
      staffRole: 'Stage Manager',
      platformAdmin: true,
      platformName: admin.name
    })
  } catch (e) {
    console.error(e)
    return err('Impersonation failed: ' + e.message, 500)
  }
}
