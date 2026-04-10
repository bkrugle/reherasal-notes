'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')
const { google } = require('googleapis')

async function calendarClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const creds = JSON.parse(json)
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar'
    ]
  })
  return google.calendar({ version: 'v3', auth })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const { calendarId, weeks } = event.queryStringParameters || {}
  if (!calendarId) return err('calendarId required')

  try {
    const calendar = await calendarClient()
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + (parseInt(weeks) || 14) * 7)

    const res = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50
    })

    const events = (res.data.items || []).map(e => ({
      id: e.id,
      title: e.summary || 'Rehearsal',
      description: e.description || '',
      location: e.location || '',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      allDay: !e.start?.dateTime,
      htmlLink: e.htmlLink || ''
    }))

    return ok({ events })
  } catch (e) {
    console.error(e)
    return err('Failed to load calendar: ' + e.message, 500)
  }
}
