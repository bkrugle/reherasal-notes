'use strict'

const { sheetsClient, getRows, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405)

  const { sheetId, showDate } = event.queryStringParameters || {}
  if (!sheetId || !showDate) return err('sheetId and showDate required')

  try {
    const sheets = await sheetsClient()

    // Get checkins for today
    let checkins = []
    try {
      const rows = await getRows(sheets, sheetId, 'Checkins!A:G')
      if (rows.length > 1) {
        const [header, ...data] = rows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        checkins = data
          .filter(r => r[idx.showDate] === showDate && r.some(Boolean))
          .map(r => ({
            castName: r[idx.castName] || '',
            checkedInAt: r[idx.checkedInAt] || '',
            checkedInBy: r[idx.checkedInBy] || '',
            note: r[idx.note] || '',
            smsAlertSent: r[idx.smsAlertSent] === 'true'
          }))
      }
    } catch (e) { /* Checkins tab doesn't exist yet */ }

    // Get config for cast list and show settings
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { if (k) config[k] = v })

    let characters = []
    try { characters = JSON.parse(config.characters || '[]') } catch {}
    const castList = characters
      .map(c => typeof c === 'string'
        ? { name: c, castMember: '' }
        : { name: c.name || '', castMember: c.castMember || '' }
      )
      .filter(c => c.name)

    return ok({
      checkins,
      castList,
      curtainTime: config.curtainTime || '',
      alertMinutes: parseInt(config.checkinAlertMinutes || '30'),
      productionTitle: config.title || '',
      showDate
    })
  } catch (e) {
    console.error(e)
    return err(e.message, 500)
  }
}
