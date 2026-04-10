import { useState } from 'react'
import { api } from '../lib/api'

const DEPARTMENTS = ['Costume', 'Music', 'Blocking', 'Set', 'Props', 'Hair & Makeup', 'Technical']

export default function CastDirectory({ sheetId, production, session }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const useAuditions = production?.config?.useAuditions === 'true' || production?.config?.useAuditions === true

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const data = await api.generateCastDirectory(sheetId, production?.config?.title, useAuditions)
      printDirectory(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function printDirectory({ productionTitle, showDates, venue, castMembers }) {
    const deptLines = DEPARTMENTS.map(d => `
      <div class="dept-row">
        <div class="dept-label">${d}</div>
        <div class="dept-lines">
          <div class="note-line"></div>
          <div class="note-line"></div>
        </div>
      </div>`).join('')

    const pages = castMembers.map(member => `
      <div class="page">
        <div class="page-header">
          <div class="production-title">${productionTitle}</div>
          ${showDates ? `<div class="show-dates">${showDates}${venue ? ' · ' + venue : ''}</div>` : ''}
        </div>
        <div class="member-section">
          <div class="photo-area">
            ${member.headshotUrl
              ? `<img src="${member.headshotUrl}" class="headshot" alt="${member.name}" />`
              : `<div class="headshot-placeholder"><span>${member.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}</span></div>`
            }
          </div>
          <div class="info-area">
            <div class="member-name">${member.name}</div>
            ${member.role ? `<div class="member-role">${member.role}</div>` : '<div class="member-role-blank">Role: _______________________________</div>'}
            <div class="contact-grid">
              <div class="contact-row"><span class="contact-label">Email</span><span class="contact-value">${member.email || '—'}</span></div>
              <div class="contact-row"><span class="contact-label">Phone</span><span class="contact-value">${member.phone || '—'}</span></div>
              ${member.grade ? `<div class="contact-row"><span class="contact-label">Grade</span><span class="contact-value">${member.grade}</span></div>` : ''}
            </div>
          </div>
        </div>
        <div class="dept-section">
          <div class="dept-header">Department notes</div>
          ${deptLines}
        </div>
      </div>`).join('<div class="page-break"></div>')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${productionTitle} — Cast Directory</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; }
  .page { width: 8.5in; min-height: 11in; padding: 0.6in 0.7in; display: flex; flex-direction: column; }
  .page-break { page-break-after: always; }
  .page-header { border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .production-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .show-dates { font-size: 11px; color: #666; }
  .member-section { display: flex; gap: 24px; margin-bottom: 24px; }
  .photo-area { flex-shrink: 0; }
  .headshot { width: 2in; height: 2.4in; object-fit: cover; border: 0.5px solid #ccc; border-radius: 4px; display: block; }
  .headshot-placeholder { width: 2in; height: 2.4in; background: #f0efe9; border: 0.5px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 600; color: #888; }
  .info-area { flex: 1; padding-top: 4px; }
  .member-name { font-size: 28px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.5px; }
  .member-role { font-size: 16px; color: #444; font-style: italic; margin-bottom: 16px; }
  .member-role-blank { font-size: 14px; color: #888; margin-bottom: 16px; }
  .contact-grid { display: flex; flex-direction: column; gap: 6px; }
  .contact-row { display: flex; gap: 8px; font-size: 13px; }
  .contact-label { color: #888; font-weight: 500; width: 40px; flex-shrink: 0; }
  .contact-value { color: #1a1a1a; }
  .dept-section { flex: 1; border-top: 0.5px solid #ddd; padding-top: 16px; }
  .dept-header { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 12px; }
  .dept-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .dept-label { font-size: 11px; font-weight: 600; color: #444; width: 90px; flex-shrink: 0; padding-top: 4px; }
  .dept-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .note-line { border-bottom: 0.5px solid #ccc; height: 18px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { page-break-after: always; }
    .page-break { display: none; }
  }
</style>
</head>
<body>${pages}</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 800)
  }

  const charCount = (() => {
    try {
      const chars = production?.config?.characters || []
      return Array.isArray(chars) ? chars.length : 0
    } catch { return 0 }
  })()

  return (
    <div className="card">
      <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Cast Directory</p>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.6 }}>
        Generate a printable directory with one page per cast member — includes headshot, contact info,
        casting, and lined department notes sections for Costume, Music, Blocking, and more.
        {!useAuditions && ' Using cast list from Setup → Characters.'}
        {useAuditions && ' Using cast members with assigned roles from auditions.'}
      </p>

      {charCount === 0 && !useAuditions && (
        <p style={{ fontSize: 13, color: 'var(--amber-text)', background: 'var(--amber-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
          No cast members in Setup → Characters yet. Add them there first.
        </p>
      )}

      {error && (
        <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>{error}</p>
      )}

      <button className="btn btn-primary" onClick={generate} disabled={loading}>
        {loading ? 'Preparing…' : '🖨 Generate & print directory'}
      </button>
    </div>
  )
}
