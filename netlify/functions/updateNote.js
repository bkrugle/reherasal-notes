'use strict'

const { sheetsClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, id, changes } = body
  if (!sheetId || !id || !changes) return err('sheetId, id, and changes required', 400, origin)

  try {
    const sheets = await sheetsClient()
    // Read full row A:U (21 cols) — accommodates new actId/sceneId columns.
    // On legacy sheets (A:S), the extra cells just come back undefined; we
    // pad below to the full new width before writing.
    const rows = await getRows(sheets, sheetId, 'Notes!A:U')
    if (rows.length < 2) return err('Note not found', 404, origin)

    const [header, ...data] = rows
    const idx = {}
    header.forEach((col, i) => { idx[col] = i })

    const rowIndex = data.findIndex(r => r[idx.id] === id)
    if (rowIndex === -1) return err('Note not found', 404, origin)

    const row = [...data[rowIndex]]
    // Pad row to full new width (A:U = 21 columns)
    while (row.length < 21) row.push('')

    // Helper for fields that may not yet have a header column (legacy sheet).
    // If the column exists, write to it. If not, write to the conventional
    // position (T=19, U=20) so when the header is upgraded later it lines up.
    function setField(name, value, conventionalIndex) {
      const i = idx[name]
      if (i !== undefined && i >= 0) {
        row[i] = value
      } else if (conventionalIndex !== undefined) {
        row[conventionalIndex] = value
      }
    }

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

    // NEW: actId / sceneId — null/undefined writes empty string
    if (changes.actId !== undefined) setField('actId', changes.actId || '', 19)     // T
    if (changes.sceneId !== undefined) setField('sceneId', changes.sceneId || '', 20) // U

    row[idx.updatedAt] = new Date().toISOString()

    const sheetRowIndex = rowIndex + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Notes!A${sheetRowIndex}:U${sheetRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    })

    return ok({ success: true, updatedAt: row[idx.updatedAt] }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to update note: ' + e.message, 500, origin)
  }
}
