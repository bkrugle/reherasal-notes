'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const sheetId = event.queryStringParameters && event.queryStringParameters.sheetId
  if (!sheetId) return err('sheetId required')

  try {
    const sheets = await sheetsClient()

    // Read Config tab
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([key, val]) => {
      if (!key) return
      try { config[key] = JSON.parse(val) }
      catch { config[key] = val || '' }
    })

    // Read SharedWith tab
    const sharedRows = await getRows(sheets, sheetId, 'SharedWith!A:G')
    let sharedWith = []
    if (sharedRows.length > 1) {
      const [header, ...data] = sharedRows
      const nameIdx = header.indexOf('name')
      const emailIdx = header.indexOf('email')
      const activatedIdx = header.indexOf('activated')
      const roleIdx = header.indexOf('role')
      const staffRoleIdx = header.indexOf('staffRole')
      sharedWith = data.filter(r => r.some(Boolean)).map(r => ({
        name: r[nameIdx] || '',
        email: r[emailIdx] || '',
        activated: r[activatedIdx] === 'true',
        role: r[roleIdx] || 'member',
        staffRole: staffRoleIdx >= 0 ? (r[staffRoleIdx] || '') : ''
      }))
    }

    return ok({ config, sharedWith })
  } catch (e) {
    console.error(e)
    return err('Failed to load production: ' + e.message, 500)
  }
}
