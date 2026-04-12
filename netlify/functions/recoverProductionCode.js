'use strict'

const { sheetsClient, getRows, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')
const https = require('https')

function sendEmail({ to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: 'Ovature <noreply@notes.vhsdrama.org>',
      to: [to], subject, html, text
    })
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => {
        const p = JSON.parse(d)
        if (res.statusCode >= 400) reject(new Error(p.message || 'Email failed'))
        else resolve(p)
      })
    })
    req.on('error', reject); req.write(body); req.end()
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { email, appUrl } = body
  if (!email) return err('Email required')
  if (!process.env.RESEND_API_KEY) return err('Email not configured', 500)

  try {
    const sheets = await sheetsClient()

    // Search Registry for matching director email
    const regRows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (regRows.length < 2) return ok({ sent: false, message: 'No productions found' })

    const [header, ...data] = regRows
    const codeIdx = header.indexOf('productionCode')
    const titleIdx = header.indexOf('title')
    const sheetIdx = header.indexOf('sheetId')

    // Check each production's config for matching director email
    const matches = []
    for (const row of data) {
      if (!row[codeIdx] || !row[sheetIdx]) continue
      try {
        const configRows = await getRows(sheets, row[sheetIdx], 'Config!A:B')
        const emailRow = configRows.find(r => r[0] === 'directorEmail')
        if (emailRow && emailRow[1] && emailRow[1].toLowerCase() === email.toLowerCase()) {
          matches.push({
            code: row[codeIdx],
            title: row[titleIdx] || 'Untitled production'
          })
        }
      } catch { /* skip if sheet inaccessible */ }
    }

    // Always return ok to avoid email enumeration
    if (!matches.length) {
      return ok({ sent: true }) // Don't reveal whether email exists
    }

    const url = appUrl || 'https://rehearsal-notes.netlify.app'
    const productionList = matches.map(m =>
      `<tr><td style="padding:8px 12px;font-weight:500">${m.title}</td><td style="padding:8px 12px;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:.08em">${m.code}</td></tr>`
    ).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h1 style="font-size:20px;margin-bottom:4px">Your production code${matches.length > 1 ? 's' : ''}</h1>
  <p style="color:#666;font-size:14px;margin-bottom:24px">Here ${matches.length > 1 ? 'are the productions' : 'is the production'} associated with ${email}:</p>
  <table style="width:100%;border-collapse:collapse;background:#f5f4f1;border-radius:10px;overflow:hidden;margin-bottom:24px">
    <thead><tr style="background:#e8e7e3">
      <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;font-weight:600">PRODUCTION</th>
      <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;font-weight:600">CODE</th>
    </tr></thead>
    <tbody>${productionList}</tbody>
  </table>
  <a href="${url}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">Go to Ovature</a>
  <p style="font-size:12px;color:#999;margin-top:24px">If you didn't request this, you can ignore this email.</p>
</body></html>`

    const text = `Your production code${matches.length > 1 ? 's' : ''}\n\n${matches.map(m => `${m.title}: ${m.code}`).join('\n')}\n\nGo to: ${url}\n\nIf you didn't request this, ignore this email.`

    await sendEmail({
      to: email,
      subject: `Your Ovature production code${matches.length > 1 ? 's' : ''}`,
      html, text
    })

    return ok({ sent: true })
  } catch (e) {
    console.error(e)
    return err('Failed: ' + e.message, 500)
  }
}
