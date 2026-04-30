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

    // NOTE: auto-migration of legacy {scenes: string[]} → {acts, scenes:[{id,...}]}
    // will happen here in a future commit, once the frontend has been updated
    // to consume the new shape. For now we return whatever's in Sheets so the
    // existing UI (LogTab, NoteCard, hashtags lib, sceneDetect lib, etc.)
    // continues to work unchanged.

    // Read SharedWith tab
    const sharedRows = await getRows(sheets, sheetId, 'SharedWith!A:I')
    let sharedWith = []
    if (sharedRows.length > 1) {
      const [header, ...data] = sharedRows
      const nameIdx = header.indexOf('name')
      const emailIdx = header.indexOf('email')
      const activatedIdx = header.indexOf('activated')
      const roleIdx = header.indexOf('role')
      const staffRoleIdx = header.indexOf('staffRole')
      const ntfyIdx = header.indexOf('ntfyTopic')
      const phoneIdx = header.indexOf('phone')
      sharedWith = data.filter(r => r.some(Boolean)).map(r => ({
        name: r[nameIdx] || '',
        email: r[emailIdx] || '',
        activated: r[activatedIdx] === 'true',
        role: r[roleIdx] || 'member',
        staffRole: staffRoleIdx >= 0 ? (r[staffRoleIdx] || '') : '',
        ntfyTopic: ntfyIdx >= 0 ? (r[ntfyIdx] || '') : '',
        phone: phoneIdx >= 0 ? (r[phoneIdx] || '') : ''
      }))
    }

    return ok({ config, sharedWith })
  } catch (e) {
    console.error(e)
    return err('Failed to load production: ' + e.message, 500)
  }
}
