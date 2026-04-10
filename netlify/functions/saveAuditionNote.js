'use strict'

const { sheetsClient, appendRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, auditionerId, text, createdBy } = body
  if (!sheetId || !auditionerId || !text) return err('sheetId, auditionerId, and text required')

  try {
    const sheets = await sheetsClient()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const now = new Date().toISOString()
    await appendRows(sheets, sheetId, 'AuditionNotes!A:F', [[id, auditionerId, text, createdBy || '', now, 'false']])
    return ok({ id, createdAt: now })
  } catch (e) {
    console.error(e)
    return err('Failed to save note: ' + e.message, 500)
  }
}
