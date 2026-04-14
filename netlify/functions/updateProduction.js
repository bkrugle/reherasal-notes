'use strict'

const { sheetsClient, driveClient, hashPin, getRows, CORS, ok, err } = require('./_sheets')

const SHARED_DRIVE_ID = '0AHO7QedLJaIHUk9PVA'

function makeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function ensureAuditionSetup(sheets, drive, sheetId, existing) {
  const results = {}

  // 1. Create Auditions folder if missing
  let auditionFolderId = existing.auditionFolderId || ''
  let headshotFolderId = existing.headshotFolderId || ''
  const rootFolderId = existing.rootFolderId || ''

  if (!auditionFolderId && rootFolderId) {
    try {
      const audFolder = await drive.files.create({
        supportsAllDrives: true,
        requestBody: { name: 'Auditions', mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] },
        fields: 'id'
      })
      auditionFolderId = audFolder.data.id
      results.auditionFolderId = auditionFolderId
    } catch (e) { console.warn('Could not create Auditions folder:', e.message) }
  }

  if (!headshotFolderId && auditionFolderId) {
    try {
      const hsFolder = await drive.files.create({
        supportsAllDrives: true,
        requestBody: { name: 'Headshots', mimeType: 'application/vnd.google-apps.folder', parents: [auditionFolderId] },
        fields: 'id'
      })
      headshotFolderId = hsFolder.data.id
      results.headshotFolderId = headshotFolderId
    } catch (e) { console.warn('Could not create Headshots folder:', e.message) }
  }

  // 2. Create Auditioners sheet tab if missing
  try {
    await getRows(sheets, sheetId, 'Auditioners!A1:A1')
  } catch (e) {
    // Tab doesn't exist — create it
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            { addSheet: { properties: { title: 'Auditioners' } } },
            { addSheet: { properties: { title: 'AuditionNotes' } } }
          ]
        }
      })
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: 'Auditioners!A1:P1', valueInputOption: 'RAW',
        requestBody: { values: [['id','submittedAt','firstName','lastName','email','phone','grade','age','experience','conflicts','headshotUrl','editToken','customAnswers','role','castConfirmed','deleted']] }
      })
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: 'AuditionNotes!A1:F1', valueInputOption: 'RAW',
        requestBody: { values: [['id','auditionerId','text','createdBy','createdAt','deleted']] }
      })
    } catch (e2) { console.warn('Could not create audition tabs:', e2.message) }
  }

  return results // folder IDs to merge back into config
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, config, sharedWith } = body
  if (!sheetId) return err('sheetId required')

  try {
    const sheets = await sheetsClient()

    if (config) {
      // Read existing config first to preserve keys we don't manage
      const existing = {}
      try {
        const existingRows = await getRows(sheets, sheetId, 'Config!A:B')
        existingRows.forEach(([k, v]) => { if (k) existing[k] = v })
      } catch (e) { console.warn('Could not read existing config:', e.message) }

      // Check if auditions are being enabled for the first time
      const wasAuditions = existing.useAuditions === 'true'
      const nowAuditions = config.useAuditions === true || config.useAuditions === 'true'

      let extraFolderIds = {}
      if (nowAuditions && !wasAuditions) {
        // Auditions just enabled — create folders and tabs
        const drive = await driveClient()
        extraFolderIds = await ensureAuditionSetup(sheets, drive, sheetId, existing)
      }

      // Merge: existing preserved, incoming overwrites, new folder IDs added
      const merged = { ...existing }
      Object.entries(config).forEach(([k, v]) => {
        if (v === null || v === undefined) {
          merged[k] = ''
        } else if (Array.isArray(v) || (typeof v === 'object')) {
          merged[k] = JSON.stringify(v)
        } else if (typeof v === 'boolean') {
          merged[k] = String(v)
        } else {
          merged[k] = String(v)  // force string — never lose a value
        }
      })
      // Add any newly created folder IDs
      Object.entries(extraFolderIds).forEach(([k, v]) => { merged[k] = v })

      const configData = Object.entries(merged).map(([k, v]) => [k, v])
      console.log('Saving config, keys:', configData.map(([k]) => k).join(', '))
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Config!A1:B' + configData.length,
        valueInputOption: 'RAW',
        requestBody: { values: configData }
      })
      // Clear any extra rows beyond what we wrote
      if (configData.length < 30) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: sheetId,
          range: `Config!A${configData.length + 1}:B50`
        }).catch(() => {})
      }
    }

    if (sharedWith !== undefined) {
      const existing = {}
      try {
        const existingRows = await getRows(sheets, sheetId, 'SharedWith!A:G')
        if (existingRows.length > 1) {
          const [h, ...data] = existingRows
          const nameIdx = h.indexOf('name')
          const emailIdx = h.indexOf('email')
          const pinIdx = h.indexOf('pinHash')
          const inviteIdx = h.indexOf('inviteCode')
          const activatedIdx = h.indexOf('activated')
          const roleIdx = h.indexOf('role')
          const staffRoleIdx = h.indexOf('staffRole')
          data.filter(r => r.some(Boolean)).forEach(r => {
            const key = (r[emailIdx] || r[nameIdx] || '').toLowerCase()
            if (key) existing[key] = {
              pinHash: r[pinIdx] || '',
              inviteCode: r[inviteIdx] || '',
              activated: r[activatedIdx] || 'false',
              role: r[roleIdx] || 'member',
              staffRole: staffRoleIdx >= 0 ? (r[staffRoleIdx] || '') : ''
            }
          })
        }
      } catch (e) { console.warn('Could not read existing members:', e.message) }

      const header = ['name', 'email', 'pinHash', 'inviteCode', 'activated', 'role', 'staffRole']
      const rows = [header]
      const newInviteCodes = {}

      sharedWith.forEach((member) => {
        const { name, email, pin, staffRole } = member
        if (!name && !email) return
        const key = (email || name || '').toLowerCase()
        const prev = existing[key]

        let pinHash = ''
        let inviteCode = ''
        let activated = 'false'

        if (prev) {
          pinHash = prev.pinHash
          inviteCode = prev.inviteCode
          activated = prev.activated
        } else {
          inviteCode = makeInviteCode()
          newInviteCodes[name || email] = inviteCode
        }

        if (pin && !prev) pinHash = hashPin(pin)

        const memberRole = (prev?.role === 'admin' || member?.role === 'admin') ? 'admin' : 'member'
        rows.push([name || '', email || '', pinHash, inviteCode, activated, memberRole, staffRole || prev?.staffRole || ''])
      })

      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: 'SharedWith!A:G' })
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `SharedWith!A1:G${rows.length}`,
        valueInputOption: 'RAW',
        requestBody: { values: rows }
      })

      return ok({ success: true, newInviteCodes })
    }

    return ok({ success: true })
  } catch (e) {
    console.error(e)
    return err('Failed to update production: ' + e.message, 500)
  }
}
