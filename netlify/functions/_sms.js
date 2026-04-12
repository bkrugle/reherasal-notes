'use strict'

const https = require('https')

/**
 * Send an SMS via Twilio
 * Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * 
 * Also supports email-to-SMS gateway as free fallback:
 * if phone looks like an email (contains @), send via Resend instead
 */
async function sendSMS(to, message) {
  if (!to) throw new Error('No recipient')

  // Email-to-SMS gateway fallback (e.g. 5551234567@vtext.com)
  if (to.includes('@')) {
    return sendEmailSMS(to, message)
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    // No Twilio configured — try email-to-SMS if we have a carrier gateway
    throw new Error('Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to env vars.')
  }

  // Normalize phone number
  const normalized = to.replace(/\D/g, '')
  const e164 = normalized.startsWith('1') ? '+' + normalized : '+1' + normalized

  const body = new URLSearchParams({
    From: from,
    To: e164,
    Body: message
  }).toString()

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64')
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${sid}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        const parsed = JSON.parse(data)
        if (res.statusCode >= 400) reject(new Error(parsed.message || 'Twilio error'))
        else resolve(parsed)
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('SMS timeout')) })
    req.write(body)
    req.end()
  })
}

async function sendEmailSMS(to, message, subject) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')

  const body = JSON.stringify({
    from: 'Rehearsal Notes <noreply@notes.vhsdrama.org>',
    to: [to],
    subject: subject || 'Rehearsal Notes Alert',
    text: message,
    html: `<p>${message}</p>`
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        const parsed = JSON.parse(data)
        if (res.statusCode >= 400) reject(new Error(parsed.message || 'Email error'))
        else resolve(parsed)
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// Send to ntfy via email gateway (topic@ntfy.sh)
// This works from server-side without needing direct ntfy.sh HTTP access
async function sendEmailToNtfy(topic, subject, message) {
  return sendEmailSMS(`${topic}@ntfy.sh`, message, subject)
}

module.exports = { sendSMS, sendEmailToNtfy }
