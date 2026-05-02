'use strict'

const { getCorsHeaders, ok, err } = require('./_sheets')
const { google } = require('googleapis')

async function calendarClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const creds = JSON.parse(json)
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/calendar']
  })
  return google.calendar({ version: 'v3', auth })
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { calendarId, eventId } = body
  if (!calendarId || !eventId) return err('calendarId and eventId required', 400, origin)

  try {
    const calendar = await calendarClient()
    await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' })
    return ok({ deleted: true }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to delete event: ' + e.message, 500, origin)
  }
}
