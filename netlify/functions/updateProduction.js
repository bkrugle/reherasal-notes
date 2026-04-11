'use strict'

const { sheetsClient, hashPin, getRows, CORS, ok, err } = require('./_sheets')

// Generate a random invite code
function makeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
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
      // Read existing config first to preserve keys we don't manage (folder IDs, etc.)
      const existing = {}
      try {
        const existingRows = await getRows(sheets, sheetId, 'Config!A:B')
        existingRows.forEach(([k, v]) => { if (k) existing[k] = v })
      } catch (e) { console.warn('Could not read existing config:', e.message) }

      // Merge: existing keys preserved, incoming keys overwrite
      const merged = { ...existing }
      Object.entries(config).forEach(([k, v]) => {
        merged[k] = typeof v === 'object' ? JSON.stringify(v)
          : typeof v === 'boolean' ? String(v)
          : (v ?? '')
      })

      const configData = Object.entries(merged).map(([k, v]) => [k, v])
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Config!A1:B' + (configData.length + 1),
        valueInputOption: 'RAW',
        requestBody: { values: configData }
      })
    }

    if (sharedWith !== undefined) {
      // Read existing members to preserve their pinHash and inviteCode
      const existing = {}
      try {
        const existingRows = await getRows(sheets, sheetId, 'SharedWith!A:F')
        if (existingRows.length > 1) {
          const [h, ...data] = existingRows
          const nameIdx = h.indexOf('name')
          const emailIdx = h.indexOf('email')
          const pinIdx = h.indexOf('pinHash')
          const inviteIdx = h.indexOf('inviteCode')
          const activatedIdx = h.indexOf('activated')
          data.filter(r => r.some(Boolean)).forEach(r => {
            const key = (r[emailIdx] || r[nameIdx] || '').toLowerCase()
            if (key) existing[key] = {
              pinHash: r[pinIdx] || '',
              inviteCode: r[inviteIdx] || '',
              activated: r[activatedIdx] || 'false'
            }
          })
        }
      } catch (e) { console.warn('Could not read existing members:', e.message) }

      // Build new rows — generate invite codes for new members
      const header = ['name', 'email', 'pinHash', 'inviteCode', 'activated', 'role']
      const rows = [header]
      const newInviteCodes = {} // name -> inviteCode for newly added members

      sharedWith.forEach((member) => {
        const { name, email, pin } = member
        if (!name && !email) return
        const key = (email || name || '').toLowerCase()
        const prev = existing[key]

        let pinHash = ''
        let inviteCode = ''
        let activated = 'false'

        if (prev) {
          // Existing member — preserve their credentials
          pinHash = prev.pinHash
          inviteCode = prev.inviteCode
          activated = prev.activated
        } else {
          // New member — generate invite code, no PIN yet
          inviteCode = makeInviteCode()
          newInviteCodes[name || email] = inviteCode
        }

        // If admin explicitly set a pin, hash it (legacy support)
        if (pin && !prev) pinHash = hashPin(pin)

        const memberRole = (prev?.role === 'admin' || member?.role === 'admin') ? 'admin' : 'member'
        rows.push([name || '', email || '', pinHash, inviteCode, activated, memberRole])
      })

      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: 'SharedWith!A:F' })
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `SharedWith!A1:F${rows.length}`,
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
