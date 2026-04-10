'use strict'

const { sheetsClient, hashPin, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, config, sharedWith } = body
  if (!sheetId) return err('sheetId required')

  try {
    const sheets = await sheetsClient()

    if (config) {
      const configData = Object.entries(config).map(([k, v]) => [
        k,
        typeof v === 'object' ? JSON.stringify(v) : (v || '')
      ])
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Config!A1:B30',
        valueInputOption: 'RAW',
        requestBody: { values: configData }
      })
    }

    if (sharedWith !== undefined) {
      // Rebuild SharedWith tab
      const rows = [['name', 'email', 'pinHash']]
      sharedWith.forEach(({ name, email, pin }) => {
        if (name || email) {
          rows.push([name || '', email || '', pin ? hashPin(pin) : ''])
        }
      })
      // Clear then rewrite
      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: 'SharedWith!A:C' })
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'SharedWith!A1:C' + rows.length,
        valueInputOption: 'RAW',
        requestBody: { values: rows }
      })
    }

    return ok({ success: true })
  } catch (e) {
    console.error(e)
    return err('Failed to update production: ' + e.message, 500)
  }
}
