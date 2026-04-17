'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')
const { sendSMS, sendEmailToNtfy } = require('./_sms')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, message, recipientIds, scheduledTime, alertTarget = 'staff' } = body
  if (!sheetId || !message) return err('sheetId and message required')

  try {
    const sheets = await sheetsClient()
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { if (k) config[k] = v })

    let notificationContacts = []
    try { notificationContacts = JSON.parse(config.notificationContacts || '[]') } catch {}

    // Build contact list from all sources — send to each person
    const allContacts = []

    // Director ntfy topic
    if (config.directorNtfyTopic || config.directorPhone) {
      allContacts.push({ name: config.directorName || 'Director', ntfyTopic: config.directorNtfyTopic, phone: config.directorPhone })
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
            const ntfyTopic = r[idx.ntfyTopic] || ''
			sed -n '93,100p' netlify/functions/sendCheckinAlerts.jsconst phone = r[idx.phone] || ''
            const name = r[idx.name] || ''
            if (ntfyTopic || phone) allContacts.push({ name, ntfyTopic, phone })
          })
      }
    } catch (e) { console.warn('Could not read SharedWith:', e.message) }

    // Legacy notificationContacts
    for (const c of notificationContacts) {
      const key = c.ntfyTopic || c.smsGateway || c.phone
      if (key) allContacts.push({ name: c.name, ntfyTopic: c.ntfyTopic, phone: c.smsGateway || c.phone })
    }

    const results = { alerted: [], failed: [], total: allContacts.length }
    const productionTitle = config.title || 'Production'
    const fullMsg = `📢 ${productionTitle} — ${message}`
    const title = `📢 ${productionTitle}`

    // Send to staff — deduplicate by ntfy topic so shared topics only get one notification
    if (alertTarget === 'staff' || alertTarget === 'all') {
      const targets = recipientIds && recipientIds.length > 0
        ? allContacts.filter((_, i) => recipientIds.includes(i))
        : allContacts

      const sentTopics = new Set()
      const sentPhones = new Set()

      for (const contact of targets) {
        try {
          if (contact.ntfyTopic) {
            if (!sentTopics.has(contact.ntfyTopic)) {
              await sendEmailToNtfy(contact.ntfyTopic, title, fullMsg)
              sentTopics.add(contact.ntfyTopic)
            }
          } else if (contact.phone) {
            if (!sentPhones.has(contact.phone)) {
              await sendSMS(contact.phone, fullMsg)
              sentPhones.add(contact.phone)
            }
          } else {
            throw new Error('No contact method')
          }
          results.alerted.push(contact.name)
        } catch (e) {
          results.failed.push({ name: contact.name, error: e.message })
        }
      }
    }

    // Send to cast members with phone numbers
    if (alertTarget === 'cast' || alertTarget === 'all') {
      let characters = []
      try { characters = JSON.parse(config.characters || '[]') } catch {}
      for (const c of characters) {
        const smsTo = (typeof c === 'object') ? (c.smsGateway || c.phone) : null
        if (!smsTo) continue
        const name = (typeof c === 'object') ? (c.castMember || c.name) : c
        try {
          await sendSMS(smsTo, fullMsg)
          results.alerted.push(name)
        } catch (e) {
          results.failed.push({ name, error: e.message })
        }
      }
    }

    return ok(results)
  } catch (e) {
    console.error(e)
    return err(e.message, 500)
  }
}
