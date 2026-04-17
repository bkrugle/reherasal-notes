'use strict'

const { sheetsClient, getRows, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')
const { sendSMS, sendEmailToNtfy } = require('./_sms')

// Expand cast list — groups are replaced by their individual members
function expandCastList(characters) {
  const expanded = []
  for (const c of characters) {
    if (typeof c === 'string') {
      expanded.push({ name: c, castMember: '', phone: '', smsGateway: '' })
    } else if (c.isGroup && Array.isArray(c.members) && c.members.length > 0) {
      for (const member of c.members) {
        expanded.push({ name: member, castMember: '', phone: '', smsGateway: '' })
      }
    } else {
      expanded.push(c)
    }
  }
  return expanded
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, showDate, curtainTime, alertMinutes = 30, alertLabel, breakALeg, alertTarget = 'staff' } = body
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

    // Get SharedWith team members
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
            ntfyTopic: r[idx.ntfyTopic] || '',
            phone: r[idx.phone] || '',
            staffRole: r[idx.staffRole] || '',
          }))
          .filter(m => m.ntfyTopic || m.phone)
      }
    } catch (e) { console.warn('Could not read SharedWith:', e.message) }

    // Build alert list — deduplicate by topic/phone but track all names
    const sentKeys = new Set()
    const alertList = []

    function addRecipient(name, ntfyTopic, phone) {
      const key = ntfyTopic || phone
      if (!key) return
      if (!sentKeys.has(key)) {
        sentKeys.add(key)
        alertList.push({ name, ntfyTopic, phone, skipSend: false })
      } else {
        alertList.push({ name, ntfyTopic, phone, skipSend: true })
      }
    }

    if (config.directorNtfyTopic || config.directorPhone) {
      addRecipient(config.directorName || 'Director', config.directorNtfyTopic, config.directorPhone)
    }
    for (const m of sharedWith) {
      addRecipient(m.name, m.ntfyTopic, m.phone)
    }
    for (const c of notificationContacts) {
      addRecipient(c.name, c.ntfyTopic, c.smsGateway || c.phone)
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

    // Expand groups and find missing cast members
    const expandedCast = expandCastList(characters)
    const missing = expandedCast.filter(c => !checkedInNames.has(c.name))

    const results = { alerted: [], failed: [], missingCount: missing.length }

    const productionTitle = config.title || 'Production'
    const timeStr = curtainTime ? ` Curtain at ${curtainTime}.` : ''
    const curtainNote = curtainTime ? ` — Curtain at ${curtainTime}` : ''
    const countdownNote = alertLabel ? ` — ${alertLabel}` : alertMinutes ? ` — ${alertMinutes}min to curtain` : ''
    const breakNote = breakALeg ? ' Break a leg!' : ''
    const allClear = missing.length === 0
    const missingNames = missing.map(c => c.castMember || c.name).join(', ')

    const title = allClear
      ? `All cast checked in!${countdownNote}`
      : `${missing.length} cast member${missing.length !== 1 ? 's' : ''} missing${countdownNote}`
    const msg = allClear
      ? `${productionTitle}${curtainNote}${countdownNote} - ALL CAST CHECKED IN!${breakNote}`
      : `${productionTitle}${curtainNote}${countdownNote} - ${missing.length} NOT checked in: ${missingNames}.${breakNote}`

    // Send to staff
    if (alertTarget === 'staff' || alertTarget === 'all') {
      for (const recipient of alertList) {
        try {
          if (!recipient.skipSend) {
            if (recipient.ntfyTopic) {
              await sendEmailToNtfy(recipient.ntfyTopic, title, msg)
            } else if (recipient.phone) {
              await sendSMS(recipient.phone, msg)
            }
          }
          results.alerted.push(recipient.name)
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
        const castMsg = `${productionTitle} - You haven't checked in yet! Please check in at the stage door ASAP.${timeStr}`
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
