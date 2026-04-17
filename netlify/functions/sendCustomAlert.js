'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')
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

    let notificationContacts = []
    try { notificationContacts = JSON.parse(config.notificationContacts || '[]') } catch {}

    // Build unified contact list from all sources
    const seen = new Set()
    const allContacts = []

    // Director ntfy topic
    if (config.directorNtfyTopic) {
      const key = config.directorNtfyTopic
      if (!seen.has(key)) {
        seen.add(key)
        allContacts.push({ name: config.directorName || 'Director', ntfyTopic: config.directorNtfyTopic })
      }
    }

    // SharedWith team members with ntfy or phone
    try {
      const swRows = await getRows(sheets, sheetId, 'SharedWith!A:I')
      if (swRows.length > 1) {
        const [header, ...data] = swRows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        data
          .filter(r => r.some(Boolean))
          .forEach(r => {
            const ntfyTopic = idx.ntfyTopic >= 0 ? (r[idx.ntfyTopic] || '') : ''
            const phone = idx.phone >= 0 ? (r[idx.phone] || '') : ''
            const name = r[idx.name] || ''
            const key = ntfyTopic || phone
            if (key && !seen.has(key)) {
              seen.add(key)
              allContacts.push({ name, ntfyTopic, phone })
            }
          })
      }
    } catch (e) { console.warn('Could not read SharedWith:', e.message) }

    // Legacy notificationContacts
    for (const c of notificationContacts) {
      const key = c.ntfyTopic || c.smsGateway || c.phone
      if (key && !seen.has(key)) {
        seen.add(key)
        allContacts.push({ name: c.name, ntfyTopic: c.ntfyTopic, phone: c.smsGateway || c.phone })
      }
    }

    // Filter to selected recipients (or all if none specified)
    const targets = recipientIds && recipientIds.length > 0
      ? allContacts.filter((_, i) => recipientIds.includes(i))
      : allContacts

    const results = { alerted: [], failed: [], total: allContacts.length }
    const productionTitle = config.title || 'Production'
    const fullMsg = `📢 ${productionTitle} — ${message}`
    const title = `📢 ${productionTitle}`

    for (const contact of targets) {
      try {
        if (contact.ntfyTopic) {
          await sendEmailToNtfy(contact.ntfyTopic, title, fullMsg)
        } else if (contact.phone) {
          await sendSMS(contact.phone, fullMsg)
        } else {
          throw new Error('No contact method')
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
