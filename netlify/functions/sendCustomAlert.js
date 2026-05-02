'use strict'

const { sheetsClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')
const { sendSMS, sendEmailToNtfy } = require('./_sms')
const https = require('https')

function resendEmail({ to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: 'Ovature <noreply@notes.vhsdrama.org>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    })
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode >= 400) reject(new Error(parsed.message || 'Email error'))
          else resolve(parsed)
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, message, recipientIds, alertTarget = 'staff', useEmail = false } = body
  if (!sheetId || !message) return err('sheetId and message required', 400, origin)

  try {
    const sheets = await sheetsClient()
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { if (k) config[k] = v })

    let notificationContacts = []
    try { notificationContacts = JSON.parse(config.notificationContacts || '[]') } catch {}

    const productionTitle = config.title || 'Production'
    const fullMsg = `📢 ${productionTitle} — ${message}`
    const ntfyTitle = `📢 ${productionTitle}`

    const results = { alerted: [], failed: [] }

    // ── EMAIL MODE (closeout) ─────────────────────────────────────────────────
    if (useEmail) {
      // Build email list from SharedWith + director + notificationContacts + cast
      const staffEmails = []
      const staffNames = []

      if (config.directorEmail) {
        staffEmails.push(config.directorEmail)
        staffNames.push(config.directorName || 'Director')
      }

      try {
        const swRows = await getRows(sheets, sheetId, 'SharedWith!A:I')
        if (swRows.length > 1) {
          const [header, ...data] = swRows
          const idx = {}; header.forEach((c, i) => { idx[c] = i })
          data.filter(r => r.some(Boolean)).forEach(r => {
            const email = r[idx.email] || ''
            const name = r[idx.name] || ''
            if (email && !staffEmails.includes(email)) {
              staffEmails.push(email)
              staffNames.push(name)
            }
          })
        }
      } catch (e) { console.warn('Could not read SharedWith:', e.message) }

      for (const c of notificationContacts) {
        if (c.email && !staffEmails.includes(c.email)) {
          staffEmails.push(c.email)
          staffNames.push(c.name)
        }
      }

      // Build cast email list
      const castEmails = []
      const castNames = []
      if (alertTarget === 'cast' || alertTarget === 'all') {
        let characters = []
        try { characters = JSON.parse(config.characters || '[]') } catch {}
        for (const c of characters) {
          if (typeof c !== 'object') continue
          const email = c.emails?.[0]
          const name = c.castMember || c.name
          if (email) { castEmails.push(email); castNames.push(name) }
        }
      }

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
          <div style="background:#0f2340;border-radius:12px;padding:20px 24px;margin-bottom:20px;">
            <h1 style="color:#fff;font-size:20px;margin:0 0 4px;">${productionTitle}</h1>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">A message from your director</p>
          </div>
          <p style="font-size:16px;line-height:1.6;color:#333;padding:16px;background:#f8f8f8;border-radius:8px;border-left:4px solid #1a365d;margin:0 0 20px;">${message}</p>
          <p style="font-size:12px;color:#999;">Sent via Ovature · ${productionTitle}</p>
        </body></html>`
      const text = `${productionTitle}\n\n${message}\n\n— Sent via Ovature`
      const subject = `${productionTitle} — Message from your director`

      // Send to staff
      if ((alertTarget === 'staff' || alertTarget === 'all') && staffEmails.length > 0) {
        try {
          await resendEmail({ to: staffEmails, subject, html, text })
          staffNames.forEach(n => results.alerted.push(n))
        } catch (e) { staffNames.forEach(n => results.failed.push({ name: n, error: e.message })) }
      }

      // Send to cast (individual emails)
      for (let i = 0; i < castEmails.length; i++) {
        try {
          await resendEmail({ to: castEmails[i], subject, html, text })
          results.alerted.push(castNames[i])
        } catch (e) { results.failed.push({ name: castNames[i], error: e.message }) }
      }

      return ok(results, origin)
    }

    // ── NTFY/SMS MODE (live show day) ─────────────────────────────────────────
    const allContacts = []

    if (config.directorNtfyTopic || config.directorPhone) {
      allContacts.push({ name: config.directorName || 'Director', ntfyTopic: config.directorNtfyTopic, phone: config.directorPhone })
    }

    try {
      const swRows = await getRows(sheets, sheetId, 'SharedWith!A:I')
      if (swRows.length > 1) {
        const [header, ...data] = swRows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        data.filter(r => r.some(Boolean)).forEach(r => {
          const ntfyTopic = r[idx.ntfyTopic] || ''
          const phone = r[idx.phone] || ''
          const name = r[idx.name] || ''
          if (ntfyTopic || phone) allContacts.push({ name, ntfyTopic, phone })
        })
      }
    } catch (e) { console.warn('Could not read SharedWith:', e.message) }

    for (const c of notificationContacts) {
      if (c.ntfyTopic || c.smsGateway || c.phone)
        allContacts.push({ name: c.name, ntfyTopic: c.ntfyTopic, phone: c.smsGateway || c.phone })
    }

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
              await sendEmailToNtfy(contact.ntfyTopic, ntfyTitle, fullMsg)
              sentTopics.add(contact.ntfyTopic)
            }
          } else if (contact.phone) {
            if (!sentPhones.has(contact.phone)) {
              await sendSMS(contact.phone, fullMsg)
              sentPhones.add(contact.phone)
            }
          } else throw new Error('No contact method')
          results.alerted.push(contact.name)
        } catch (e) { results.failed.push({ name: contact.name, error: e.message }) }
      }
    }

    if (alertTarget === 'cast' || alertTarget === 'all') {
      let characters = []
      try { characters = JSON.parse(config.characters || '[]') } catch {}
      for (const c of characters) {
        if (typeof c !== 'object') continue
        const smsTo = c.smsGateway || c.phone
        if (!smsTo) continue
        const name = c.castMember || c.name
        try {
          await sendSMS(smsTo, fullMsg)
          results.alerted.push(name)
        } catch (e) { results.failed.push({ name, error: e.message }) }
      }
    }

    return ok(results, origin)
  } catch (e) {
    console.error(e)
    return err(e.message, 500, origin)
  }
}
