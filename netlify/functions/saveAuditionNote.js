'use strict'

const { sheetsClient, appendRows, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, auditionerId, text, createdBy } = body
  if (!sheetId || !auditionerId || !text) return err('sheetId, auditionerId, and text required', 400, origin)

  try {
    const sheets = await sheetsClient()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const now = new Date().toISOString()
    await appendRows(sheets, sheetId, 'AuditionNotes!A:F', [[id, auditionerId, text, createdBy || '', now, 'false']])
    return ok({ id, createdAt: now }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to save note: ' + e.message, 500, origin)
  }
}
