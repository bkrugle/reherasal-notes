'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')
const https = require('https')

function resendEmail({ to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: 'Ovature <noreply@notes.vhsdrama.org>',
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
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode >= 400) reject(new Error(parsed.message || 'Email error'))
          else resolve(parsed)
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function fmtMs(ms) {
  if (!ms) return '—'
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York'
  })
}

function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York'
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, allTimelines, closingNote, productionCode } = body
  if (!sheetId) return err('sheetId required')

  try {
    const sheets = await sheetsClient()

    // Get config
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { if (k) config[k] = v })

    const productionTitle = config.title || 'Production'
    const directorEmail = config.directorEmail || ''
    const directorName = config.directorName || 'Director'

    // Get curtain times to know show dates
    let curtainTimes = {}
    try { curtainTimes = JSON.parse(config.curtainTimes || '{}') } catch {}
    const showDates = Object.keys(curtainTimes).sort()

    // Get SM email
    let smEmail = ''
    let smName = 'Stage Manager'
    try {
      const swRows = await getRows(sheets, sheetId, 'SharedWith!A:I')
      if (swRows.length > 1) {
        const [header, ...data] = swRows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        const sm = data.find(r => (r[idx.staffRole] || '').toLowerCase().includes('stage manager'))
        if (sm) { smEmail = sm[idx.email] || ''; smName = sm[idx.name] || 'Stage Manager' }
      }
    } catch (e) { console.warn('Could not read SharedWith:', e.message) }

    // Get all notes
    let allNotes = []
    try {
      const notesRows = await getRows(sheets, sheetId, 'Notes!A:S')
      if (notesRows.length > 1) {
        const [header, ...data] = notesRows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        allNotes = data
          .filter(r => r[idx.deleted] !== 'true' && r.some(Boolean))
          .map(r => ({
            text: r[idx.text] || '',
            category: r[idx.category] || 'general',
            cast: r[idx.cast] || '',
            priority: r[idx.priority] || 'med',
            resolved: r[idx.resolved] === 'true',
            date: r[idx.date] || '',
          }))
      }
    } catch (e) { console.warn('Could not read notes:', e.message) }

    // Notes stats
    const totalNotes = allNotes.length
    const resolvedNotes = allNotes.filter(n => n.resolved).length
    const openNotes = allNotes.filter(n => !n.resolved)

    // Notes by category
    const byCategory = {}
    allNotes.forEach(n => {
      const cat = n.category || 'general'
      byCategory[cat] = (byCategory[cat] || 0) + 1
    })

    // Compute run times per show date
    const timelines = allTimelines || {}
    const runRows = showDates.map((date, i) => {
      const t = timelines[date]
      if (!t || t.phase !== 'done') return { date, perf: i + 1, label: fmtDateShort(date), times: null }
      const a1 = t.act1Start && t.act1End ? new Date(t.act1End) - new Date(t.act1Start) : 0
      const int = t.intermissionStart && t.intermissionEnd ? new Date(t.intermissionEnd) - new Date(t.intermissionStart) : 0
      const a2 = t.act2Start && t.act2End ? new Date(t.act2End) - new Date(t.act2Start) : 0
      return { date, perf: i + 1, label: fmtDateShort(date), times: { a1, int, a2, total: a1 + int + a2 } }
    })
    const completedRuns = runRows.filter(r => r.times)

    const avgTotal = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.total, 0) / completedRuns.length : 0
    const avgInt = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.int, 0) / completedRuns.length : 0
    const avgA1 = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.a1, 0) / completedRuns.length : 0
    const avgA2 = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.a2, 0) / completedRuns.length : 0

    // Build HTML email
    const runTableRows = runRows.map(row => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px 12px; font-size: 13px; color: #333;">${row.label}</td>
        <td style="padding: 8px 12px; font-size: 13px; text-align: right; font-variant-numeric: tabular-nums;">${row.times ? fmtMs(row.times.a1) : '—'}</td>
        <td style="padding: 8px 12px; font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; color: ${row.times && row.times.int > 15*60*1000 ? '#ef4444' : 'inherit'};">${row.times ? fmtMs(row.times.int) : '—'}</td>
        <td style="padding: 8px 12px; font-size: 13px; text-align: right; font-variant-numeric: tabular-nums;">${row.times ? fmtMs(row.times.a2) : '—'}</td>
        <td style="padding: 8px 12px; font-size: 13px; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums;">${row.times ? fmtMs(row.times.total) : '—'}</td>
      </tr>`).join('')

    const categoryRows = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 6px 12px; font-size: 13px; text-transform: capitalize;">${cat}</td>
          <td style="padding: 6px 12px; font-size: 13px; text-align: right; font-weight: 600;">${count}</td>
        </tr>`).join('')

    const openNoteRows = openNotes.slice(0, 20).map(n => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 6px 8px; font-size: 12px; color: #666;">${n.date}</td>
        <td style="padding: 6px 8px; font-size: 12px; color: #333;">${n.cast || '—'}</td>
        <td style="padding: 6px 8px; font-size: 12px; text-transform: capitalize;">${n.category}</td>
        <td style="padding: 6px 8px; font-size: 13px;">${n.text}</td>
      </tr>`).join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Final Show Report — ${productionTitle}</title></head>
<body style="font-family: -apple-system, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; color: #111;">

  <div style="background: linear-gradient(135deg, #0f2340, #1a365d); border-radius: 12px; padding: 28px; margin-bottom: 28px; color: white; text-align: center;">
    <div style="font-size: 36px; margin-bottom: 8px;">🎭</div>
    <h1 style="margin: 0 0 6px; font-size: 26px; font-weight: 800;">${productionTitle}</h1>
    <p style="margin: 0; opacity: 0.7; font-size: 14px;">Final Show Report · ${showDates.length} Performance${showDates.length !== 1 ? 's' : ''}</p>
    ${showDates.length > 0 ? `<p style="margin: 8px 0 0; opacity: 0.6; font-size: 13px;">${fmtDateShort(showDates[0])} — ${fmtDateShort(showDates[showDates.length - 1])}</p>` : ''}
  </div>

  ${closingNote ? `
  <div style="background: #f8faff; border-left: 4px solid #1a365d; border-radius: 4px; padding: 14px 16px; margin-bottom: 24px;">
    <p style="font-size: 13px; font-weight: 600; margin: 0 0 4px; color: #1a365d;">Director's Note</p>
    <p style="font-size: 14px; margin: 0; color: #333;">${closingNote}</p>
  </div>` : ''}

  <h2 style="font-size: 16px; margin: 0 0 12px; color: #0f2340;">⏱ Run Times</h2>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
    <tr style="background: #0f2340; color: white;">
      <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Performance</th>
      <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Act 1</th>
      <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Int.</th>
      <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Act 2</th>
      <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
    </tr>
    ${runTableRows}
    ${completedRuns.length > 1 ? `
    <tr style="background: #f0f4ff; font-weight: 600;">
      <td style="padding: 10px 12px; font-size: 13px;">Average</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: right; font-variant-numeric: tabular-nums;">${fmtMs(avgA1)}</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; color: ${avgInt > 15*60*1000 ? '#ef4444' : 'inherit'};">${fmtMs(avgInt)}</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: right; font-variant-numeric: tabular-nums;">${fmtMs(avgA2)}</td>
      <td style="padding: 10px 12px; font-size: 14px; text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; color: #1a365d;">${fmtMs(avgTotal)}</td>
    </tr>` : ''}
  </table>

  <h2 style="font-size: 16px; margin: 0 0 12px; color: #0f2340;">📝 Notes Summary</h2>
  <div style="display: flex; gap: 12px; margin-bottom: 16px;">
    <div style="flex: 1; background: #f9f9f9; border-radius: 8px; padding: 14px; text-align: center;">
      <div style="font-size: 28px; font-weight: 800; color: #0f2340;">${totalNotes}</div>
      <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Total Notes</div>
    </div>
    <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 14px; text-align: center;">
      <div style="font-size: 28px; font-weight: 800; color: #16a34a;">${resolvedNotes}</div>
      <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Resolved</div>
    </div>
    <div style="flex: 1; background: ${openNotes.length > 0 ? '#fffbeb' : '#f9f9f9'}; border-radius: 8px; padding: 14px; text-align: center;">
      <div style="font-size: 28px; font-weight: 800; color: ${openNotes.length > 0 ? '#d97706' : '#666'};">${openNotes.length}</div>
      <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Still Open</div>
    </div>
  </div>

  ${Object.keys(byCategory).length > 0 ? `
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
    <tr style="background: #f0f0f0;">
      <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase;">Category</th>
      <th style="padding: 8px 12px; text-align: right; font-size: 11px; text-transform: uppercase;">Count</th>
    </tr>
    ${categoryRows}
  </table>` : ''}

  ${openNotes.length > 0 ? `
  <h2 style="font-size: 16px; margin: 0 0 12px; color: #0f2340;">🔓 Open Notes at Close (${openNotes.length})</h2>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
    <tr style="background: #f0f0f0;">
      <th style="padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase;">Date</th>
      <th style="padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase;">Dept/Cast</th>
      <th style="padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase;">Category</th>
      <th style="padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase;">Note</th>
    </tr>
    ${openNoteRows}
    ${openNotes.length > 20 ? `<tr><td colspan="4" style="padding: 8px 12px; font-size: 12px; color: #666; text-align: center;">...and ${openNotes.length - 20} more</td></tr>` : ''}
  </table>` : `
  <div style="background: #f0fdf4; border-radius: 8px; padding: 14px; text-align: center; margin-bottom: 28px;">
    <p style="color: #16a34a; font-weight: 600; margin: 0;">✅ All notes resolved at close of production!</p>
  </div>`}

  <p style="font-size: 12px; color: #999; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; text-align: center;">
    Sent by Ovature · ${productionTitle} · Final Show Report
  </p>
</body>
</html>`

    const text = `Final Show Report — ${productionTitle}\n${showDates.length} Performances\n\nRun Times:\n${runRows.map(r => `${r.label}: ${r.times ? `Act 1 ${fmtMs(r.times.a1)} / Int ${fmtMs(r.times.int)} / Act 2 ${fmtMs(r.times.a2)} / Total ${fmtMs(r.times.total)}` : '—'}`).join('\n')}\n\nNotes: ${totalNotes} total, ${resolvedNotes} resolved, ${openNotes.length} open${closingNote ? '\n\nDirector\'s Note: ' + closingNote : ''}`

    const recipients = [directorEmail, smEmail].filter(Boolean)
    if (recipients.length === 0) return err('No email addresses configured for director or SM')

    await resendEmail({
      to: recipients,
      subject: `Final Show Report — ${productionTitle}`,
      html,
      text
    })

    return ok({ sent: true, recipients, smName, smEmail, directorEmail })
  } catch (e) {
    console.error(e)
    return err('Failed to send closeout report: ' + e.message, 500)
  }
}
