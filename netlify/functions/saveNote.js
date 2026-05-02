'use strict'

const { sheetsClient, appendRows, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, note } = body
  if (!sheetId || !note || !note.text) return err('sheetId and note.text required', 400, origin)

  try {
    const sheets = await sheetsClient()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const now = new Date().toISOString()

    // Notes sheet width is now A:U (21 columns) — added actId (T) and sceneId (U).
    // Legacy sheets without these columns: append still works because
    // appendRows detects the actual sheet width and pads.
    await appendRows(sheets, sheetId, 'Notes!A:U', [[
      id,                                    // A: id
      note.date || now.slice(0, 10),         // B: date
      note.scene || '',                      // C: scene (display label, kept for back-compat)
      note.category || 'general',            // D: category
      note.priority || 'med',                // E: priority
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
      note.pinnedBy || '',                   // S: pinnedBy
      note.actId || '',                      // T: actId   (NEW)
      note.sceneId || ''                     // U: sceneId (NEW)
    ]])

    return ok({ id, createdAt: now }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to save note: ' + e.message, 500, origin)
  }
}
