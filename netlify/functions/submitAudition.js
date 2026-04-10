'use strict'

const { sheetsClient, driveClient, getRows, appendRows, CORS, ok, err } = require('./_sheets')
const { google } = require('googleapis')
const https = require('https')

function makeToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let t = ''
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)]
  return t
}

async function uploadHeadshot(drive, folderId, base64Data, auditionerId) {
  if (!base64Data || !folderId) return ''
  try {
    const { google } = require('googleapis')
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const creds = JSON.parse(json)
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive'] })
    const authClient = await auth.getClient()
    const accessToken = await authClient.getAccessToken()
    const boundary = 'boundary' + Date.now()
    const metadata = JSON.stringify({ name: `headshot-${auditionerId}.jpg`, parents: [folderId] })
    const multipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
      Buffer.from(base64Data),
      Buffer.from(`\r\n--${boundary}--`)
    ])
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken.token,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
          'Content-Length': multipart.length
        }
      }, res => {
        let d = ''; res.on('data', c => d += c)
        res.on('end', () => resolve(JSON.parse(d)))
      })
      req.on('error', reject)
      req.write(multipart); req.end()
    })
    return result.webViewLink || ''
  } catch (e) {
    console.warn('Headshot upload failed:', e.message)
    return ''
  }
}

function resendEmail({ to, subject, html, text, replyTo, fromName }) {
  return new Promise((resolve, reject) => {
    const from = fromName ? `${fromName} <noreply@notes.vhsdrama.org>` : 'Rehearsal Notes <noreply@notes.vhsdrama.org>'
    const body = JSON.stringify({ from, to: [to], reply_to: replyTo || undefined, subject, html, text })
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { const p = JSON.parse(d); if (res.statusCode >= 400) reject(new Error(p.message)); else resolve(p) }) })
    req.on('error', reject); req.write(body); req.end()
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, headshotFolderId, appUrl, productionTitle, directorEmail,
    firstName, lastName, email, phone, grade, age, experience, conflicts, customAnswers,
    headshotBase64, editToken: existingToken } = body

  if (!sheetId || !firstName || !lastName) return err('sheetId, firstName, and lastName required')

  try {
    const sheets = await sheetsClient()
    const drive = await driveClient()

    const id = existingToken
      ? null // will find by token
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

    const editToken = existingToken || makeToken()
    const now = new Date().toISOString()

    // If editing, find existing row
    let rowIndex = -1
    let existingId = id
    if (existingToken) {
      const rows = await getRows(sheets, sheetId, 'Auditioners!A:P')
      if (rows.length > 1) {
        const [header, ...data] = rows
        const tokenIdx = header.indexOf('editToken')
        const idIdx = header.indexOf('id')
        const ri = data.findIndex(r => r[tokenIdx] === existingToken)
        if (ri >= 0) { rowIndex = ri + 2; existingId = data[ri][idIdx] }
      }
    }

    // Upload headshot
    let headshotUrl = ''
    if (headshotBase64 && headshotFolderId) {
      headshotUrl = await uploadHeadshot(drive, headshotFolderId, headshotBase64, existingId || id)
    }

    const rowData = [
      existingId || id, now,
      firstName, lastName, email || '', phone || '',
      grade || '', age || '', experience || '', conflicts || '',
      headshotUrl, editToken,
      JSON.stringify(customAnswers || {}),
      '', 'false', 'false'
    ]

    if (rowIndex > 0) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: `Auditioners!A${rowIndex}:P${rowIndex}`,
        valueInputOption: 'RAW', requestBody: { values: [rowData] }
      })
    } else {
      await appendRows(sheets, sheetId, 'Auditioners!A:P', [rowData])
    }

    // Send confirmation email
    if (email && process.env.RESEND_API_KEY) {
      const editUrl = `${appUrl || 'https://rehearsal-notes.netlify.app'}/audition-edit/${editToken}`
      const answers = customAnswers || {}
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h1 style="font-size:20px;margin-bottom:4px">${productionTitle || 'Audition'} — Confirmation</h1>
  <p style="color:#666;font-size:14px;margin-bottom:24px">Thank you for auditioning!</p>
  <p style="font-size:14px;margin-bottom:20px">Hi ${firstName}, here's a summary of the information you submitted:</p>
  <div style="background:#f5f4f1;border-radius:12px;padding:16px 20px;margin-bottom:20px">
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:4px 0;color:#666;width:40%">Name</td><td style="padding:4px 0;font-weight:500">${firstName} ${lastName}</td></tr>
      ${email ? `<tr><td style="padding:4px 0;color:#666">Email</td><td style="padding:4px 0">${email}</td></tr>` : ''}
      ${phone ? `<tr><td style="padding:4px 0;color:#666">Phone</td><td style="padding:4px 0">${phone}</td></tr>` : ''}
      ${grade ? `<tr><td style="padding:4px 0;color:#666">Grade</td><td style="padding:4px 0">${grade}</td></tr>` : ''}
      ${age ? `<tr><td style="padding:4px 0;color:#666">Age</td><td style="padding:4px 0">${age}</td></tr>` : ''}
      ${conflicts ? `<tr><td style="padding:4px 0;color:#666">Conflicts</td><td style="padding:4px 0">${conflicts}</td></tr>` : ''}
      ${Object.entries(answers).map(([q, a]) => `<tr><td style="padding:4px 0;color:#666">${q}</td><td style="padding:4px 0">${a}</td></tr>`).join('')}
    </table>
  </div>
  <p style="font-size:14px;margin-bottom:8px">If any information is incorrect, you can update it here:</p>
  <a href="${editUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">Update my information</a>
  <p style="font-size:12px;color:#999;margin-top:24px">Good luck — we'll be in touch!</p>
</body></html>`

      const text = `${productionTitle || 'Audition'} — Confirmation\n\nHi ${firstName}, thank you for auditioning!\n\nYour information:\nName: ${firstName} ${lastName}\n${email ? 'Email: ' + email + '\n' : ''}${phone ? 'Phone: ' + phone + '\n' : ''}${conflicts ? 'Conflicts: ' + conflicts + '\n' : ''}\nIf anything is incorrect, update it here: ${editUrl}\n\nGood luck!`

      await resendEmail({ to: email, subject: `${productionTitle || 'Audition'} — Your submission`, html, text, replyTo: directorEmail || undefined }).catch(e => console.warn('Email failed:', e.message))
    }

    return ok({ id: existingId || id, editToken })
  } catch (e) {
    console.error(e)
    return err('Failed to submit audition: ' + e.message, 500)
  }
}
