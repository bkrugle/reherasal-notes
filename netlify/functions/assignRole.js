'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, auditionerId, role } = body
  if (!sheetId || !auditionerId) return err('sheetId and auditionerId required')

  try {
    const sheets = await sheetsClient()
    const rows = await getRows(sheets, sheetId, 'Auditioners!A:P')
    if (rows.length < 2) return err('Not found', 404)
    const [header, ...data] = rows
    const idx = {}; header.forEach((c, i) => { idx[c] = i })
    const ri = data.findIndex(r => r[idx.id] === auditionerId)
    if (ri < 0) return err('Auditioner not found', 404)
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
    return ok({ success: true })
  } catch (e) {
    console.error(e)
    return err('Failed: ' + e.message, 500)
  }
}
