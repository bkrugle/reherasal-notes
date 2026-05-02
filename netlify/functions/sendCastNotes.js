'use strict'

const { getCorsHeaders, ok, err } = require('./_sheets')
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
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { to, castName, notes: rawNotes, productionTitle, directorName, directorEmail } = body
  const notes = (rawNotes || []).filter(n => !n.privateNote)
  if (!to || !notes || !castName) return err('to, castName, and notes required', 400, origin)
  if (!process.env.RESEND_API_KEY) return err('RESEND_API_KEY not configured', 500, origin)

  const catColor = {
    blocking: '#ba7517', performance: '#7f77dd', music: '#1d9e75',
    technical: '#d85a30', general: '#639922', costume: '#d4537e', set: '#378add'
  }

  // Group notes by date
  const byDate = {}
  notes.forEach(n => {
    if (!byDate[n.date]) byDate[n.date] = []
    byDate[n.date].push(n)
  })

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <h1 style="font-size:20px;margin-bottom:4px">${productionTitle}</h1>
  <p style="color:#666;font-size:14px;margin-bottom:8px">Notes for <strong>${castName}</strong></p>
  <p style="color:#999;font-size:12px;margin-bottom:24px">From ${directorName || 'Your Director'}</p>`

  let text = `${productionTitle}\nNotes for ${castName}\nFrom ${directorName || 'Your Director'}\n\n`

  Object.entries(byDate).sort().forEach(([date, ns]) => {
    const dt = new Date(date + 'T00:00:00')
    const dateLabel = dt.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    html += `<h2 style="font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin:20px 0 8px">${dateLabel}</h2><ul style="margin:0;padding-left:20px">`
    text += `${dateLabel.toUpperCase()}\n`
    ns.forEach(n => {
      const col = catColor[n.category] || '#888'
      const cue = n.cue ? ` <em>(@ ${n.cue})</em>` : ''
      const pri = n.priority === 'high'
      html += `<li style="margin:6px 0;font-size:14px">
        <span style="background:${col}22;color:${col};font-size:11px;padding:1px 6px;border-radius:8px;font-weight:600">${n.category}</span>
        ${cue}${pri ? ' <span style="color:#a32d2d">★</span>' : ''} — ${n.text}
        ${n.carriedOver === 'true' ? '<span style="font-size:11px;color:#ba7517"> (carried over)</span>' : ''}
      </li>`
      text += `• [${n.category}]${n.cue ? ' @ ' + n.cue : ''}${pri ? ' ★' : ''} — ${n.text}\n`
    })
    html += '</ul>'
    text += '\n'
  })

  html += `<p style="margin-top:32px;font-size:13px;color:#999">
    Questions? Reply to this email to reach ${directorName || 'your director'}.
  </p></body></html>`
  text += `\nQuestions? Reply to this email.\n— ${directorName || 'Director'}`

  try {
    await resendEmail({
      to: Array.isArray(to) ? to : [to],
      subject: `Your notes — ${productionTitle}`,
      html,
      text,
      replyTo: directorEmail || undefined,
      fromName: directorName || 'Ovature™'
    })
    return ok({ sent: true }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to send: ' + e.message, 500, origin)
  }
}
