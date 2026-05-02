'use strict'

const { sheetsClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')
const { sanitizeInput, validateSheetId } = require('./_validation')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, id, changes } = body
  if (!sheetId || !id || !changes) return err('sheetId, id, and changes required', 400, origin)
  if (!validateSheetId(sheetId)) return err('Invalid sheetId', 400, origin)

  // Sanitize text fields in changes
  const safeChanges = { ...changes }
  if (changes.text !== undefined) safeChanges.text = sanitizeInput(changes.text)
  if (changes.scene !== undefined) safeChanges.scene = sanitizeInput(changes.scene)
  if (changes.cast !== undefined) safeChanges.cast = sanitizeInput(changes.cast)
  if (changes.cue !== undefined) safeChanges.cue = sanitizeInput(changes.cue)
  if (changes.pinnedBy !== undefined) safeChanges.pinnedBy = sanitizeInput(changes.pinnedBy)
  if (changes.castList !== undefined && Array.isArray(changes.castList)) {
    safeChanges.castList = changes.castList.map(c => sanitizeInput(c))
  }

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

    if (safeChanges.text !== undefined) row[idx.text] = safeChanges.text
    if (safeChanges.scene !== undefined) row[idx.scene] = safeChanges.scene
    if (safeChanges.category !== undefined) row[idx.category] = safeChanges.category
    if (safeChanges.priority !== undefined) row[idx.priority] = safeChanges.priority
    if (safeChanges.cast !== undefined) row[idx.cast] = safeChanges.cast
    if (safeChanges.cue !== undefined) row[idx.cue] = safeChanges.cue
    if (safeChanges.resolved !== undefined) row[idx.resolved] = String(safeChanges.resolved)
    if (safeChanges.deleted !== undefined) row[idx.deleted] = String(safeChanges.deleted)
    if (safeChanges.pinned !== undefined) row[idx.pinned] = String(safeChanges.pinned)
    if (safeChanges.pinnedBy !== undefined) row[idx.pinnedBy] = safeChanges.pinnedBy
    if (safeChanges.privateNote !== undefined) row[idx.privateNote] = String(safeChanges.privateNote)
    if (safeChanges.carriedOver !== undefined) row[idx.carriedOver] = String(safeChanges.carriedOver)
    if (safeChanges.attachmentUrl !== undefined) row[idx.attachmentUrl] = safeChanges.attachmentUrl
    if (safeChanges.castList !== undefined) row[idx.castList] = Array.isArray(safeChanges.castList) ? safeChanges.castList.join(', ') : safeChanges.castList

    // NEW: actId / sceneId — null/undefined writes empty string
    if (safeChanges.actId !== undefined) setField('actId', safeChanges.actId || '', 19)     // T
    if (safeChanges.sceneId !== undefined) setField('sceneId', safeChanges.sceneId || '', 20) // U

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
