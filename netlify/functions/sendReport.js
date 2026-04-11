'use strict'

const { CORS, ok, err } = require('./_sheets')
const https = require('https')

function resendEmail({ to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: 'Rehearsal Notes <noreply@notes.vhsdrama.org>',
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

  const { to, subject, notes, productionTitle, date, directorName, directorEmail } = body
  if (!to || !notes) return err('to and notes required')

  if (!process.env.RESEND_API_KEY) return err('RESEND_API_KEY not configured', 500)

  const dt = new Date(date + 'T00:00:00')
  const dateLabel = dt.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  const byScene = {}
  notes.forEach(n => {
    const k = n.scene || 'General'
    if (!byScene[k]) byScene[k] = []
    byScene[k].push(n)
  })

  const catColor = {
    blocking: '#ba7517', performance: '#7f77dd', music: '#1d9e75',
    technical: '#d85a30', general: '#639922', costume: '#d4537e', set: '#378add'
  }

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <h1 style="font-size:20px;margin-bottom:4px">${productionTitle}</h1>
  <p style="color:#666;font-size:14px;margin-bottom:24px">Rehearsal report — ${dateLabel}</p>`

  let text = `${productionTitle}\nRehearsal report — ${dateLabel}\n\n`

  Object.entries(byScene).forEach(([scene, ns]) => {
    html += `<h2 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin:20px 0 8px">${scene}</h2><ul style="margin:0;padding-left:20px">`
    text += `${scene.toUpperCase()}\n`
    ns.forEach(n => {
      const col = catColor[n.category] || '#888'
      const pri = n.priority === 'high'
      const who = n.cast ? ` <strong>${n.cast}</strong>` : ''
      const cue = n.cue ? ` <em>(@ ${n.cue})</em>` : ''
      html += `<li style="margin:6px 0;font-size:14px">
        <span style="background:${col}22;color:${col};font-size:11px;padding:1px 6px;border-radius:8px;font-weight:600">${n.category}</span>
        ${who}${cue}${pri ? ' <span style="color:#a32d2d">★</span>' : ''} — ${n.text}
      </li>`
      text += `• [${n.category}]${n.cast ? ' ' + n.cast : ''}${n.cue ? ' @ ' + n.cue : ''}${pri ? ' ★' : ''} — ${n.text}\n`
    })
    html += '</ul>'
    text += '\n'
  })

  html += `<p style="margin-top:32px;font-size:13px;color:#999">Sent by ${directorName || 'Director'} via Rehearsal Notes</p>
</body></html>`
  text += `\n— ${directorName || 'Director'}`

  try {
    const recipients = Array.isArray(to) ? to : [to]
    await resendEmail({
      to: recipients,
      subject: subject || `Rehearsal report — ${dateLabel}`,
      html,
      text,
      replyTo: directorEmail || undefined,
      fromName: directorName || 'Rehearsal Notes'
    })
    return ok({ sent: true })
  } catch (e) {
    console.error(e)
    return err('Failed to send: ' + e.message, 500)
  }
}
