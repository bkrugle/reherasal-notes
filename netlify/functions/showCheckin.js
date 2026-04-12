'use strict'

const { sheetsClient, getRows, appendRows, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  // GET — return current check-in status (for public checkin page to verify)
  if (event.httpMethod === 'GET') {
    const { productionCode, showDate } = event.queryStringParameters || {}
    if (!productionCode || !showDate) return err('productionCode and showDate required')
    try {
      const sheets = await sheetsClient()
      const sheetId = await getSheetId(sheets, productionCode)
      if (!sheetId) return err('Production not found', 404)
      await ensureCheckinTab(sheets, sheetId)
      const rows = await getRows(sheets, sheetId, 'Checkins!A:G')
      const [header, ...data] = rows.length > 1 ? rows : [['id','showDate','castName','checkedInAt','checkedInBy','note','smsAlertSent'], []]
      const idx = {}; header.forEach((c, i) => { idx[c] = i })
      const todayCheckins = data.filter(r => r[idx.showDate] === showDate && r.some(Boolean))
      const config = await getConfig(sheets, sheetId)
      let characters = []
      try { characters = JSON.parse(config.characters || '[]') } catch {}
      const castList = characters
        .map(c => typeof c === 'string'
          ? { name: c, castMember: '' }
          : { name: c.name || '', castMember: c.castMember || '' }
        )
        .filter(c => c.name)
      return ok({ checkins: todayCheckins.map(r => ({
        castName: r[idx.castName],
        checkedInAt: r[idx.checkedInAt],
        note: r[idx.note] || ''
      })), productionTitle: config.title || '', showDate, castList })
    } catch (e) { return err(e.message, 500) }
  }

  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { productionCode, showDate, castName, note, checkedInBy } = body
  if (!productionCode || !showDate || !castName) return err('productionCode, showDate, and castName required')

  try {
    const sheets = await sheetsClient()
    const sheetId = await getSheetId(sheets, productionCode)
    if (!sheetId) return err('Production not found', 404)

    await ensureCheckinTab(sheets, sheetId)

    // Check if already checked in
    const rows = await getRows(sheets, sheetId, 'Checkins!A:G')
    const [header, ...data] = rows.length > 1 ? rows : [['id','showDate','castName','checkedInAt','checkedInBy','note','smsAlertSent'], []]
    const idx = {}; header.forEach((c, i) => { idx[c] = i })
    const already = data.find(r => r[idx.showDate] === showDate && r[idx.castName] === castName && r.some(Boolean))
    if (already) return ok({ success: true, alreadyCheckedIn: true, checkedInAt: already[idx.checkedInAt] })

    const id = Date.now().toString(36)
    const now = new Date().toISOString()
    await appendRows(sheets, sheetId, 'Checkins!A:G', [[
      id, showDate, castName, now, checkedInBy || 'Self', note || '', 'false'
    ]])

    return ok({ success: true, alreadyCheckedIn: false, checkedInAt: now })
  } catch (e) {
    console.error(e)
    return err('Check-in failed: ' + e.message, 500)
  }
}

async function getSheetId(sheets, productionCode) {
  const rows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
  if (rows.length < 2) return null
  const [header, ...data] = rows
  const codeIdx = header.indexOf('productionCode')
  const sheetIdx = header.indexOf('sheetId')
  const row = data.find(r => r[codeIdx] === productionCode.toUpperCase())
  return row ? row[sheetIdx] : null
}

async function getConfig(sheets, sheetId) {
  const rows = await getRows(sheets, sheetId, 'Config!A:B')
  const config = {}
  rows.forEach(([k, v]) => { if (k) config[k] = v })
  return config
}

async function ensureCheckinTab(sheets, sheetId) {
  try {
    await getRows(sheets, sheetId, 'Checkins!A1:A1')
  } catch (e) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Checkins' } } }] }
    }).catch(() => {})
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId, range: 'Checkins!A1:G1', valueInputOption: 'RAW',
      requestBody: { values: [['id','showDate','castName','checkedInAt','checkedInBy','note','smsAlertSent']] }
    })
  }
}
