'use strict'

const { CORS, ok, err } = require('./_sheets')
const https = require('https')

function resendEmail({ to, subject, html, text, replyTo, fromName }) {
  return new Promise((resolve, reject) => {
    const from = fromName
      ? `${fromName} <noreply@notes.vhsdrama.org>`
      : 'Ovature <noreply@notes.vhsdrama.org>'
    const body = JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo || undefined,
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
        const parsed = JSON.parse(data)
        if (res.statusCode >= 400) reject(new Error(parsed.message || 'Resend error'))
        else resolve(parsed)
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const {
    to, memberName, productionTitle, productionCode,
    inviteCode, appUrl, directorName, directorEmail
  } = body

  if (!to || !productionCode || !inviteCode) return err('to, productionCode, and inviteCode required')
  if (!process.env.RESEND_API_KEY) return err('RESEND_API_KEY not configured', 500)

  const url = appUrl || 'https://rehearsal-notes.netlify.app'
  const firstName = memberName ? memberName.split(' ')[0] : 'there'

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h1 style="font-size:22px;margin-bottom:4px">You've been added to ${productionTitle}</h1>
  <p style="color:#666;font-size:14px;margin-bottom:28px">From ${directorName || 'Your Director'}</p>

  <p style="font-size:15px;margin-bottom:24px">Hi ${firstName},</p>
  <p style="font-size:14px;line-height:1.6;margin-bottom:24px">
    You've been added as a team member for <strong>${productionTitle}</strong>. 
    Use the details below to sign in and set your own PIN.
  </p>

  <div style="background:#f5f4f1;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <div style="margin-bottom:16px">
      <p style="font-size:11px;color:#888;font-weight:600;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Production code</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:.1em;color:#1a1a1a;margin:0">${productionCode}</p>
    </div>
    <div>
      <p style="font-size:11px;color:#888;font-weight:600;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Invite code (one-time use)</p>
      <p style="font-size:22px;font-weight:600;letter-spacing:.08em;color:#1a1a1a;margin:0">${inviteCode}</p>
    </div>
  </div>

  <p style="font-size:14px;line-height:1.6;margin-bottom:20px">
    Go to <a href="${url}" style="color:#185fa5">${url}</a>, enter your production code and invite code, 
    then you'll be prompted to choose your own PIN.
  </p>

  <p style="font-size:13px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
    Questions? Reply to this email to reach ${directorName || 'your director'}.
  </p>
</body></html>`

  const text = `You've been added to ${productionTitle}

Hi ${firstName},

You've been added as a team member. Use the details below to sign in and set your own PIN.

Production code: ${productionCode}
Invite code (one-time use): ${inviteCode}

Go to ${url}, enter your production code and invite code, then you'll be prompted to choose your own PIN.

Questions? Reply to this email.
— ${directorName || 'Director'}`

  try {
    await resendEmail({
      to,
      subject: `You've been added to ${productionTitle}`,
      html,
      text,
      replyTo: directorEmail || undefined,
      fromName: directorName || 'Ovature™'
    })
    return ok({ sent: true })
  } catch (e) {
    console.error(e)
    return err('Failed to send welcome email: ' + e.message, 500)
  }
}
