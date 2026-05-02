'use strict'

const { sheetsClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, showDate, timeline } = body
  if (!sheetId || !showDate || !timeline) return err('sheetId, showDate, and timeline required', 400, origin)

  try {
    const sheets = await sheetsClient()

    // Check if Timeline tab exists, create if not
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const timelineSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Timeline')

    if (!timelineSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: 'Timeline' } }
          }]
        }
      })
      // Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Timeline!A1:D1',
        valueInputOption: 'RAW',
        requestBody: { values: [['showDate', 'timeline', 'lockedBy', 'updatedAt']] }
      })
    }

    // Check if row for this date already exists
    const rows = await getRows(sheets, sheetId, 'Timeline!A:D')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === showDate)

    const row = [
      showDate,
      JSON.stringify(timeline),
      timeline.lockedBy || '',
      new Date().toISOString()
    ]

    if (rowIndex === -1) {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Timeline!A:D',
        valueInputOption: 'RAW',
        requestBody: { values: [row] }
      })
    } else {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Timeline!A${rowIndex + 1}:D${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] }
      })
    }

    return ok({ success: true }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to save timeline: ' + e.message, 500, origin)
  }
}
