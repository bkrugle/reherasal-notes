'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const { sheetId, showDate } = event.queryStringParameters || {}
  if (!sheetId || !showDate) return err('sheetId and showDate required')

  try {
    const sheets = await sheetsClient()

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const timelineSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Timeline')
    if (!timelineSheet) return ok({ timeline: null })

    const rows = await getRows(sheets, sheetId, 'Timeline!A:D')
    if (rows.length < 2) return ok({ timeline: null })

    const [header, ...data] = rows
    const row = data.find(r => r[0] === showDate)
    if (!row) return ok({ timeline: null })

    const timeline = JSON.parse(row[1] || 'null')
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
      body: JSON.stringify({ timeline, lockedBy: row[2] || '', updatedAt: row[3] || '' })
    }
  } catch (e) {
    console.error(e)
    return err('Failed to get timeline: ' + e.message, 500)
  }
}
