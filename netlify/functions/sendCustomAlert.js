'use strict'

const { sheetsClient, getRows, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')
const { sendSMS, sendEmailToNtfy } = require('./_sms')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, message, recipientIds, scheduledTime } = body
  if (!sheetId || !message) return err('sheetId and message required')

  try {
    const sheets = await sheetsClient()
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { if (k) config[k] = v })

    let contacts = []
    try { contacts = JSON.parse(config.notificationContacts || '[]') } catch {}

    // Filter to selected recipients (or all if none specified)
    const targets = recipientIds && recipientIds.length > 0
      ? contacts.filter((_, i) => recipientIds.includes(i))
      : contacts

    const results = { alerted: [], failed: [] }
    const productionTitle = config.title || 'Production'
    const fullMsg = `📢 ${productionTitle} — ${message}`

    for (const contact of targets) {
      try {
        if (contact.ntfyTopic) {
          await sendEmailToNtfy(contact.ntfyTopic, `📢 ${productionTitle}`, fullMsg)
        } else {
          const to = contact.smsGateway || contact.phone
          if (to) await sendSMS(to, fullMsg)
          else throw new Error('No contact method')
        }
        results.alerted.push(contact.name)
      } catch (e) {
        results.failed.push({ name: contact.name, error: e.message })
      }
    }

    return ok(results)
  } catch (e) {
    console.error(e)
    return err(e.message, 500)
  }
}
