'use strict'

const { sheetsClient, driveClient, getRows, appendRows, getCorsHeaders, ok, err } = require('./_sheets')
const { sanitizeInput, sanitizeObject, validateEmail, validatePhone, validateSheetId } = require('./_validation')
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
        path: '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,webContentLink',
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
    // Make file publicly readable so it can be displayed in the app
    if (result.id) {
      await new Promise((resolve) => {
        const permBody = JSON.stringify({ role: 'reader', type: 'anyone' })
        const permReq = https.request({
          hostname: 'www.googleapis.com',
          path: `/drive/v3/files/${result.id}/permissions?supportsAllDrives=true`,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken.token,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(permBody)
          }
        }, res => { res.resume(); res.on('end', resolve) })
        permReq.on('error', () => resolve())
        permReq.write(permBody); permReq.end()
      })
    }
    // Use thumbnail URL - works without Google login
    return result.id ? `https://lh3.googleusercontent.com/d/${result.id}` : ''
  } catch (e) {
    console.error('Headshot upload failed:', e.message, e.stack)
    return ''
  }
}

function resendEmail({ to, subject, html, text, replyTo, fromName }) {
  return new Promise((resolve, reject) => {
    const from = fromName ? `${fromName} <noreply@notes.vhsdrama.org>` : 'Ovature <noreply@notes.vhsdrama.org>'
    const body = JSON.stringify({ from, to: [to], reply_to: replyTo || undefined, subject, html, text })
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { const p = JSON.parse(d); if (res.statusCode >= 400) reject(new Error(p.message)); else resolve(p) }) })
    req.on('error', reject); req.write(body); req.end()
  })
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, headshotFolderId, appUrl, productionTitle, directorEmail, productionCode,
    firstName, lastName, email, phone, grade, age, experience, conflicts, customAnswers,
    headshotBase64, editToken: existingToken, smsGateway } = body

  if (!sheetId || !firstName || !lastName) return err('sheetId, firstName, and lastName required', 400, origin)

  // Validate inputs
  if (!validateSheetId(sheetId)) return err('Invalid sheetId', 400, origin)
  if (email && !validateEmail(email)) return err('Invalid email format', 400, origin)
  if (phone && !validatePhone(phone)) return err('Invalid phone format', 400, origin)

  // Sanitize text inputs for safe storage
  const safeFirstName = sanitizeInput(firstName)
  const safeLastName = sanitizeInput(lastName)
  const safeExperience = sanitizeInput(experience || '')
  const safeConflicts = sanitizeInput(conflicts || '')
  const safeGrade = sanitizeInput(grade || '')
  const safeAge = sanitizeInput(age || '')
  const safeCustomAnswers = customAnswers ? sanitizeObject(customAnswers) : {}

  try {
    const sheets = await sheetsClient()
    const drive = await driveClient()

    // Ensure Auditioners and AuditionNotes tabs exist (for productions created before audition support)
    try {
      await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Auditioners!A1' })
    } catch (e) {
      // Tab doesn't exist — create it
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            { addSheet: { properties: { title: 'Auditioners' } } },
            { addSheet: { properties: { title: 'AuditionNotes' } } }
          ]
        }
      }).catch(() => {}) // ignore if already exists
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: 'Auditioners!A1:P1', valueInputOption: 'RAW',
        requestBody: { values: [['id','submittedAt','firstName','lastName','email','phone','grade','age','experience','conflicts','headshotUrl','editToken','customAnswers','role','castConfirmed','deleted']] }
      })
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: 'AuditionNotes!A1:F1', valueInputOption: 'RAW',
        requestBody: { values: [['id','auditionerId','text','createdBy','createdAt','deleted']] }
      }).catch(() => {})
    }

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

    // Upload headshot — create folder if missing (productions created before folder support)
    let headshotUrl = ''
    let effectiveFolderId = headshotFolderId
    if (headshotBase64) {
      if (!effectiveFolderId) {
        try {
          // Try to find or create Headshots folder under production root
          const configRows = await getRows(sheets, sheetId, 'Config!A:B')
          const rootRow = configRows.find(r => r[0] === 'rootFolderId')
          const auditionFolderRow = configRows.find(r => r[0] === 'auditionFolderId')
          const parentId = auditionFolderRow?.[1] || rootRow?.[1]
          if (parentId) {
            const folderRes = await drive.files.create({
              supportsAllDrives: true,
              requestBody: { name: 'Headshots', mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
              fields: 'id'
            })
            effectiveFolderId = folderRes.data.id
            // Save back to config so we don't recreate next time
            await sheets.spreadsheets.values.append({
              spreadsheetId: sheetId, range: 'Config!A:B', valueInputOption: 'RAW',
              requestBody: { values: [['headshotFolderId', effectiveFolderId]] }
            })
          }
        } catch (e) { console.warn('Could not create headshot folder:', e.message) }
      }
      if (effectiveFolderId) {
        headshotUrl = await uploadHeadshot(drive, effectiveFolderId, headshotBase64, existingId || id)
      }
    }

    const rowData = [
      existingId || id, now,
      safeFirstName, safeLastName, email || '', phone || '',
      safeGrade, safeAge, safeExperience, safeConflicts,
      headshotUrl, editToken,
      JSON.stringify({ ...safeCustomAnswers, smsGateway: smsGateway || '' }),
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
      const editUrl = `${appUrl || 'https://rehearsal-notes.netlify.app'}/audition-edit/${editToken}?code=${encodeURIComponent(productionCode || '')}`
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h1 style="font-size:20px;margin-bottom:4px">${sanitizeInput(productionTitle || 'Audition')} — Confirmation</h1>
  <p style="color:#666;font-size:14px;margin-bottom:24px">Thank you for auditioning!</p>
  <p style="font-size:14px;margin-bottom:20px">Hi ${safeFirstName}, here's a summary of the information you submitted:</p>
  <div style="background:#f5f4f1;border-radius:12px;padding:16px 20px;margin-bottom:20px">
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:4px 0;color:#666;width:40%">Name</td><td style="padding:4px 0;font-weight:500">${safeFirstName} ${safeLastName}</td></tr>
      ${email ? `<tr><td style="padding:4px 0;color:#666">Email</td><td style="padding:4px 0">${email}</td></tr>` : ''}
      ${phone ? `<tr><td style="padding:4px 0;color:#666">Phone</td><td style="padding:4px 0">${phone}</td></tr>` : ''}
      ${safeGrade ? `<tr><td style="padding:4px 0;color:#666">Grade</td><td style="padding:4px 0">${safeGrade}</td></tr>` : ''}
      ${safeAge ? `<tr><td style="padding:4px 0;color:#666">Age</td><td style="padding:4px 0">${safeAge}</td></tr>` : ''}
      ${safeConflicts ? `<tr><td style="padding:4px 0;color:#666">Conflicts</td><td style="padding:4px 0">${safeConflicts}</td></tr>` : ''}
      ${Object.entries(safeCustomAnswers).map(([q, a]) => `<tr><td style="padding:4px 0;color:#666">${sanitizeInput(q)}</td><td style="padding:4px 0">${sanitizeInput(a)}</td></tr>`).join('')}
    </table>
  </div>
  <p style="font-size:14px;margin-bottom:8px">If any information is incorrect, you can update it here:</p>
  <a href="${editUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">Update my information</a>
  <p style="font-size:12px;color:#999;margin-top:24px">Good luck — we'll be in touch!</p>
</body></html>`

      const text = `${sanitizeInput(productionTitle || 'Audition')} — Confirmation\n\nHi ${safeFirstName}, thank you for auditioning!\n\nYour information:\nName: ${safeFirstName} ${safeLastName}\n${email ? 'Email: ' + email + '\n' : ''}${phone ? 'Phone: ' + phone + '\n' : ''}${safeConflicts ? 'Conflicts: ' + safeConflicts + '\n' : ''}\nIf anything is incorrect, update it here: ${editUrl}\n\nGood luck!`

      await resendEmail({ to: email, subject: `${productionTitle || 'Audition'} — Your submission`, html, text, replyTo: directorEmail || undefined }).catch(e => console.warn('Email failed:', e.message))
    }

    return ok({ id: existingId || id, editToken }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to submit audition: ' + e.message, 500, origin)
  }
}
