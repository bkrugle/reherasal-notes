'use strict'

const { sheetsClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, auditionerId, role } = body
  if (!sheetId || !auditionerId) return err('sheetId and auditionerId required', 400, origin)

  try {
    const sheets = await sheetsClient()

    // 1. Update the auditioner's role
    const rows = await getRows(sheets, sheetId, 'Auditioners!A:P')
    if (rows.length < 2) return err('Not found', 404, origin)
    const [header, ...data] = rows
    const idx = {}; header.forEach((c, i) => { idx[c] = i })
    const ri = data.findIndex(r => r[idx.id] === auditionerId)
    if (ri < 0) return err('Auditioner not found', 404, origin)

    const rowIndex = ri + 2
    const row = [...data[ri]]
    while (row.length < header.length) row.push('')
    row[idx.role] = role || ''
    row[idx.castConfirmed] = role ? 'true' : 'false'
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Auditioners!A${rowIndex}:P${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    })

    // 2. If a role was assigned, sync to the Characters list in Config
    if (role) {
      const auditioner = data[ri]
      const firstName = auditioner[idx.firstName] || ''
      const lastName = auditioner[idx.lastName] || ''
      const email = auditioner[idx.email] || ''
      const phone = auditioner[idx.phone] || ''
      const fullName = `${firstName} ${lastName}`.trim()
      // Pull smsGateway from customAnswers if stored there
      let smsGateway = ''
      try {
        const ca = JSON.parse(auditioner[idx.customAnswers] || '{}')
        smsGateway = ca.smsGateway || ''
      } catch {}

      // Read current config
      const configRows = await getRows(sheets, sheetId, 'Config!A:B')
      const configMap = {}
      configRows.forEach(([k, v]) => { if (k) configMap[k] = v })

      // Parse existing characters
      let characters = []
      try { characters = JSON.parse(configMap.characters || '[]') } catch {}

      // Normalize to objects
      characters = characters.map(c =>
        typeof c === 'string'
          ? { name: c, emails: [], members: [], isGroup: false }
          : c
      )

      // Check if role already exists
      const existingRoleIdx = characters.findIndex(c => {
        const name = typeof c === 'string' ? c : c.name
        return name === role
      })

      if (existingRoleIdx >= 0) {
        // Role exists — add email if not already there
        const existing = characters[existingRoleIdx]
        const emails = existing.emails || []
        if (email && !emails.includes(email)) {
          existing.emails = [...emails, email]
          // Also track who is cast in this role via a castMember field
          existing.castMember = fullName
          existing.phone = phone
          if (smsGateway) existing.smsGateway = smsGateway
        }
        characters[existingRoleIdx] = existing
      } else {
        // New role — add it with cast member info
        characters.push({
          name: role,
          emails: email ? [email] : [],
          members: [],
          isGroup: false,
          castMember: fullName,
          phone: phone,
          smsGateway: smsGateway
        })
      }

      // Write back — merge into config preserving all other keys
      const merged = { ...configMap, characters: JSON.stringify(characters) }
      const configData = Object.entries(merged).map(([k, v]) => [k, v])
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Config!A1:B' + (configData.length + 1),
        valueInputOption: 'RAW',
        requestBody: { values: configData }
      })
    }

    return ok({ success: true }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed: ' + e.message, 500, origin)
  }
}
