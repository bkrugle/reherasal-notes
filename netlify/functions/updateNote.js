'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, id, changes } = body
  if (!sheetId || !id || !changes) return err('sheetId, id, and changes required')

  try {
    const sheets = await sheetsClient()
    const rows = await getRows(sheets, sheetId, 'Notes!A:N')
    if (rows.length < 2) return err('Note not found', 404)

    const [header, ...data] = rows
    const idx = {}
    header.forEach((col, i) => { idx[col] = i })

    const rowIndex = data.findIndex(r => r[idx.id] === id)
    if (rowIndex === -1) return err('Note not found', 404)

    const row = [...data[rowIndex]]
    // Pad row to full width
    while (row.length < header.length) row.push('')

    if (changes.text !== undefined) row[idx.text] = changes.text
    if (changes.scene !== undefined) row[idx.scene] = changes.scene
    if (changes.category !== undefined) row[idx.category] = changes.category
    if (changes.priority !== undefined) row[idx.priority] = changes.priority
    if (changes.cast !== undefined) row[idx.cast] = changes.cast
    if (changes.cue !== undefined) row[idx.cue] = changes.cue
    if (changes.resolved !== undefined) row[idx.resolved] = String(changes.resolved)
    if (changes.deleted !== undefined) row[idx.deleted] = String(changes.deleted)
    row[idx.updatedAt] = new Date().toISOString()

    const sheetRowIndex = rowIndex + 2 // +1 for header, +1 for 1-based index
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Notes!A${sheetRowIndex}:N${sheetRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    })

    return ok({ success: true, updatedAt: row[idx.updatedAt] })
  } catch (e) {
    console.error(e)
    return err('Failed to update note: ' + e.message, 500)
  }
}
