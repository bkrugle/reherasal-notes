'use strict'

const { sheetsClient, appendRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, note } = body
  if (!sheetId || !note || !note.text) return err('sheetId and note.text required')

  try {
    const sheets = await sheetsClient()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const now = new Date().toISOString()

    await appendRows(sheets, sheetId, 'Notes!A:S', [[
      id,                                    // A: id
      note.date || now.slice(0, 10),         // B: date
      note.scene || '',                      // C: scene
      note.category || 'general',            // D: category
      note.priority || 'med',               // E: priority
      note.cast || '',                       // F: cast
      note.cue || '',                        // G: cue
      note.swTime || '',                     // H: swTime
      note.text,                             // I: text
      'false',                               // J: resolved
      now,                                   // K: createdAt
      now,                                   // L: updatedAt
      note.createdBy || '',                  // M: createdBy
      'false',                               // N: deleted
      note.carriedOver ? 'true' : 'false',   // O: carriedOver
      note.attachmentUrl || '',              // P: attachmentUrl
      note.pinned ? 'true' : 'false',        // Q: pinned
      note.privateNote ? 'true' : 'false',   // R: privateNote
      note.pinnedBy || ''                    // S: pinnedBy
    ]])

    return ok({ id, createdAt: now })
  } catch (e) {
    console.error(e)
    return err('Failed to save note: ' + e.message, 500)
  }
}
