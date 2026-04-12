'use strict'

const { sheetsClient, getRows, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')
const { sendSMS } = require('./_sms')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, showDate, curtainTime, alertMinutes = 30 } = body
  if (!sheetId || !showDate) return err('sheetId and showDate required')

  try {
    const sheets = await sheetsClient()

    // Get config — staff phone numbers / SMS gateways
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { if (k) config[k] = v })

    let characters = []
    let staff = []
    try { characters = JSON.parse(config.characters || '[]') } catch {}
    try { staff = JSON.parse(config.staff || '[]') } catch {}

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

    // Find missing cast members who have phone numbers
    const castList = characters.map(c => typeof c === 'string'
      ? { name: c, phone: '', smsGateway: '' }
      : c
    )

    const missing = castList.filter(c => !checkedInNames.has(c.name))

    // Send alerts to SM / staff with SMS configured
    const staffWithSMS = staff.filter(s => typeof s === 'object' && (s.phone || s.smsGateway))

    const results = { alerted: [], failed: [], missingCount: missing.length }

    const productionTitle = config.title || 'Production'
    const timeStr = curtainTime ? ` Curtain at ${curtainTime}.` : ''

    for (const sm of staffWithSMS) {
      const smsTo = sm.smsGateway || sm.phone
      const missingNames = missing.map(c => c.name).join(', ')
      const autoNote = body.autoFired ? ' [Auto 1-hr alert]' : ''
      const msg = missing.length === 0
        ? `✅ ${productionTitle}${timeStr} — ALL CAST CHECKED IN! 🎭${autoNote}`
        : `⚠️ ${productionTitle}${timeStr} — ${missing.length} NOT checked in: ${missingNames}.${autoNote}`

      try {
        await sendSMS(smsTo, msg)
        results.alerted.push(sm.name || smsTo)
      } catch (e) {
        results.failed.push({ name: sm.name || smsTo, error: e.message })
      }
    }

    // Also alert missing cast members directly if they have phone numbers
    for (const castMember of missing) {
      const smsTo = castMember.smsGateway || castMember.phone
      if (!smsTo) continue
      const msg = `📢 ${productionTitle} — You haven't checked in yet! Please check in at the stage door ASAP.${timeStr}`
      try {
        await sendSMS(smsTo, msg)
        results.alerted.push(castMember.name)
      } catch (e) {
        results.failed.push({ name: castMember.name, error: e.message })
      }
    }

    return ok(results)
  } catch (e) {
    console.error(e)
    return err(e.message, 500)
  }
}
