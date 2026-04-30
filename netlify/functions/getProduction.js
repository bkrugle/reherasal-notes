'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')
const { migrateConfig } = require('./_actsScenes')

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

    // ---- Auto-migrate legacy acts/scenes shape (back-compatible) ---------
    // Run the migrator in memory to derive the new structured shape, but
    // ALSO return the flat-string array as `scenes` so existing consumers
    // (LogTab, NoteCard, ReviewTab, hashtags, sceneDetect, etc.) keep
    // working unchanged. The new structured shape is exposed alongside:
    //   config.acts          = [{id, name, order}, ...]
    //   config.scenes_struct = [{id, name, actId, order}, ...]
    // The flat `config.scenes` remains a legacy string[] until every
    // consumer is updated.
    const migrated = migrateConfig(config)
    if (Array.isArray(migrated.acts)) {
      config.acts = migrated.acts
      const struct = Array.isArray(migrated.scenes) ? migrated.scenes : []
      config.scenes_struct = struct
      // Always expose flat names as `scenes` for back-compat
      config.scenes = struct.map(s => typeof s === 'string' ? s : (s && s.name) || '').filter(Boolean)
    }

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
