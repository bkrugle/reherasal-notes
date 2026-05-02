'use strict'

const { sheetsClient, appendRows, getCorsHeaders, ok, err } = require('./_sheets')
const { sanitizeInput, validateSheetId } = require('./_validation')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, note } = body
  if (!sheetId || !note || !note.text) return err('sheetId and note.text required', 400, origin)
  if (!validateSheetId(sheetId)) return err('Invalid sheetId', 400, origin)

  // Sanitize all text fields in the note
  const safeText = sanitizeInput(note.text)
  const safeScene = sanitizeInput(note.scene || '')
  const safeCast = sanitizeInput(note.cast || '')
  const safeCue = sanitizeInput(note.cue || '')
  const safeCreatedBy = sanitizeInput(note.createdBy || '')
  const safePinnedBy = sanitizeInput(note.pinnedBy || '')

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
      safeScene,                             // C: scene (display label, kept for back-compat)
      note.category || 'general',            // D: category
      note.priority || 'med',                // E: priority
      safeCast,                              // F: cast
      safeCue,                               // G: cue
      note.swTime || '',                     // H: swTime
      safeText,                              // I: text
      'false',                               // J: resolved
      now,                                   // K: createdAt
      now,                                   // L: updatedAt
      safeCreatedBy,                         // M: createdBy
      'false',                               // N: deleted
      note.carriedOver ? 'true' : 'false',   // O: carriedOver
      note.attachmentUrl || '',              // P: attachmentUrl
      note.pinned ? 'true' : 'false',        // Q: pinned
      note.privateNote ? 'true' : 'false',   // R: privateNote
      safePinnedBy,                          // S: pinnedBy
      note.actId || '',                      // T: actId   (NEW)
      note.sceneId || ''                     // U: sceneId (NEW)
    ]])

    return ok({ id, createdAt: now }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to save note: ' + e.message, 500, origin)
  }
}
