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
    // Read full row A:S to preserve all columns including pinnedBy
    const rows = await getRows(sheets, sheetId, 'Notes!A:S')
    if (rows.length < 2) return err('Note not found', 404)

    const [header, ...data] = rows
    const idx = {}
    header.forEach((col, i) => { idx[col] = i })

    const rowIndex = data.findIndex(r => r[idx.id] === id)
    if (rowIndex === -1) return err('Note not found', 404)

    const row = [...data[rowIndex]]
    // Pad row to full width (A:S = 19 columns)
    while (row.length < 19) row.push('')

    if (changes.text !== undefined) row[idx.text] = changes.text
    if (changes.scene !== undefined) row[idx.scene] = changes.scene
    if (changes.category !== undefined) row[idx.category] = changes.category
    if (changes.priority !== undefined) row[idx.priority] = changes.priority
    if (changes.cast !== undefined) row[idx.cast] = changes.cast
    if (changes.cue !== undefined) row[idx.cue] = changes.cue
    if (changes.resolved !== undefined) row[idx.resolved] = String(changes.resolved)
    if (changes.deleted !== undefined) row[idx.deleted] = String(changes.deleted)
    if (changes.pinned !== undefined) row[idx.pinned] = String(changes.pinned)
    if (changes.pinnedBy !== undefined) row[idx.pinnedBy] = changes.pinnedBy
    if (changes.privateNote !== undefined) row[idx.privateNote] = String(changes.privateNote)
    if (changes.carriedOver !== undefined) row[idx.carriedOver] = String(changes.carriedOver)
    if (changes.attachmentUrl !== undefined) row[idx.attachmentUrl] = changes.attachmentUrl
    if (changes.castList !== undefined) row[idx.castList] = Array.isArray(changes.castList) ? changes.castList.join(', ') : changes.castList
    row[idx.updatedAt] = new Date().toISOString()

    const sheetRowIndex = rowIndex + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Notes!A${sheetRowIndex}:S${sheetRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    })

    return ok({ success: true, updatedAt: row[idx.updatedAt] })
  } catch (e) {
    console.error(e)
    return err('Failed to update note: ' + e.message, 500)
  }
}
