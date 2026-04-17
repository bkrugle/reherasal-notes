'use strict'

const { sheetsClient, getRows, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')
const { sendSMS, sendEmailToNtfy } = require('./_sms')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, showDate, curtainTime, alertMinutes = 30, alertLabel, breakALeg, alertTarget = 'staff' } = body
  // alertTarget: 'staff' | 'cast' | 'all'
  if (!sheetId || !showDate) return err('sheetId and showDate required')

  try {
    const sheets = await sheetsClient()

    // Get config
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { if (k) config[k] = v })

    let characters = []
    let notificationContacts = []
    try { characters = JSON.parse(config.characters || '[]') } catch {}
    try { notificationContacts = JSON.parse(config.notificationContacts || '[]') } catch {}

    // Get SharedWith team members who have ntfy topics
    let sharedWith = []
    try {
      const swRows = await getRows(sheets, sheetId, 'SharedWith!A:I')
      if (swRows.length > 1) {
        const [header, ...data] = swRows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        sharedWith = data
          .filter(r => r.some(Boolean))
          .map(r => ({
            name: r[idx.name] || '',
            email: r[idx.email] || '',
            ntfyTopic: idx.ntfyTopic >= 0 ? (r[idx.ntfyTopic] || '') : '',
            phone: idx.phone >= 0 ? (r[idx.phone] || '') : '',
            staffRole: idx.staffRole >= 0 ? (r[idx.staffRole] || '') : '',
          }))
          .filter(m => m.ntfyTopic || m.phone)
      }
    } catch (e) { console.warn('Could not read SharedWith:', e.message) }

    // Build unified alert list — combine notificationContacts + sharedWith + director
    // De-duplicate by ntfyTopic or phone
    const seen = new Set()
    const alertList = []

    // Add director ntfy if configured
    if (config.directorNtfyTopic) {
      const key = config.directorNtfyTopic
      if (!seen.has(key)) {
        seen.add(key)
        alertList.push({ name: config.directorName || 'Director', ntfyTopic: config.directorNtfyTopic })
      }
    }

    // Add SharedWith team members
    for (const m of sharedWith) {
      const key = m.ntfyTopic || m.phone
      if (key && !seen.has(key)) {
        seen.add(key)
        alertList.push(m)
      }
    }

    // Add notificationContacts (legacy)
    for (const c of notificationContacts) {
      const key = c.ntfyTopic || c.smsGateway || c.phone
      if (key && !seen.has(key)) {
        seen.add(key)
        alertList.push({ name: c.name, ntfyTopic: c.ntfyTopic, phone: c.smsGateway || c.phone })
      }
    }

    // Get today's checkins
    let checkedInNames = new Set()
    try {
      const checkinRows = await getRows(sheets, sheetId, 'Checkins!A:G')
      if (checkinRows.length > 1) {
        const [header, ...data] = checkinRows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        data.filter(r => r[idx.showDate] === showDate && r.some(Boolean))
            .forEach(r => checkedInNames.add(r[idx.castName]))
      }
    } catch (e) { console.warn('No checkins tab yet') }

    // Find missing cast members
    const castList = characters.map(c => typeof c === 'string'
      ? { name: c, castMember: '', phone: '', smsGateway: '' }
      : c
    )
    const missing = castList.filter(c => !checkedInNames.has(c.name))

    const results = { alerted: [], failed: [], missingCount: missing.length }

    const productionTitle = config.title || 'Production'
    const timeStr = curtainTime ? ` Curtain at ${curtainTime}.` : ''
    const curtainNote = curtainTime ? ` — Curtain at ${curtainTime}` : ''
    const countdownNote = alertLabel ? ` — ${alertLabel}` : alertMinutes ? ` — ${alertMinutes}min to curtain` : ''
    const breakNote = breakALeg ? ' 🌟 Break a leg!' : ''
    const allClear = missing.length === 0
    const missingNames = missing.map(c => c.castMember ? `${c.castMember} (${c.name})` : c.name).join(', ')

    const title = allClear
      ? `✅ All cast checked in!${countdownNote}`
      : `⚠️ ${missing.length} cast member${missing.length !== 1 ? 's' : ''} missing${countdownNote}`
    const msg = allClear
      ? `✅ ${productionTitle}${curtainNote}${countdownNote} — ALL CAST CHECKED IN! 🎭${breakNote}`
      : `⚠️ ${productionTitle}${curtainNote}${countdownNote} — ${missing.length} NOT checked in: ${missingNames}.${breakNote}`

    // Send to staff alert recipients
    if (alertTarget === 'staff' || alertTarget === 'all') {
      for (const recipient of alertList) {
        try {
          if (recipient.ntfyTopic) {
            await sendEmailToNtfy(recipient.ntfyTopic, title, msg)
          } else if (recipient.phone) {
            await sendSMS(recipient.phone, msg)
          }
          results.alerted.push(recipient.name || recipient.ntfyTopic || recipient.phone)
        } catch (e) {
          results.failed.push({ name: recipient.name, error: e.message })
        }
      }
    }

    // Alert missing cast members directly if they have phone numbers
    if (alertTarget === 'cast' || alertTarget === 'all') {
      for (const castMember of missing) {
        const smsTo = castMember.smsGateway || castMember.phone
        if (!smsTo) continue
        const castMsg = `📢 ${productionTitle} — You haven't checked in yet! Please check in at the stage door ASAP.${timeStr}`
        try {
          await sendSMS(smsTo, castMsg)
          results.alerted.push(castMember.castMember || castMember.name)
        } catch (e) {
          results.failed.push({ name: castMember.name, error: e.message })
        }
      }
    }

    return ok(results)
  } catch (e) {
    console.error(e)
    return err(e.message, 500)
  }
}
