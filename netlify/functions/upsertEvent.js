'use strict'

const { getCorsHeaders, ok, err } = require('./_sheets')
const { google } = require('googleapis')

async function calendarClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const creds = JSON.parse(json)
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      'https://www.googleapis.com/auth/calendar'
    ]
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

  const { calendarId, eventId, title, description, location, start, end, allDay, attendees } = body
  if (!calendarId || !title || !start) return err('calendarId, title, and start required', 400, origin)

  try {
    const calendar = await calendarClient()

    const eventBody = {
      summary: title,
      description: description || '',
      location: location || '',
      start: allDay ? { date: start.slice(0, 10) } : { dateTime: start, timeZone: 'America/New_York' },
      end: allDay ? { date: (end || start).slice(0, 10) } : { dateTime: end || start, timeZone: 'America/New_York' },
    }

    if (attendees && attendees.length) {
      eventBody.attendees = attendees.map(email => ({ email }))
    }

    let result
    if (eventId) {
      // Update existing event
      result = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventBody,
        sendUpdates: attendees?.length ? 'all' : 'none'
      })
    } else {
      // Create new event
      result = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
        sendUpdates: attendees?.length ? 'all' : 'none'
      })
    }

    return ok({
      id: result.data.id,
      htmlLink: result.data.htmlLink,
      title: result.data.summary
    }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to save event: ' + e.message, 500, origin)
  }
}
