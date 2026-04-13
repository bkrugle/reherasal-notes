import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import CustomAlertPanel from './CustomAlertPanel'

const POLL_INTERVAL = 20000

function printCheckinPage(title, url, venue) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — Cast Check-in</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Georgia, serif;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; padding: 40px;
      background: white; color: #111;
      text-align: center;
    }
    .show-title {
      font-size: 42px; font-weight: bold;
      line-height: 1.2; margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .venue {
      font-size: 18px; color: #555;
      margin-bottom: 40px; font-style: italic;
    }
    .qr-wrapper {
      border: 3px solid #111;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 32px;
      display: inline-block;
    }
    .qr-wrapper img {
      display: block; width: 280px; height: 280px;
    }
    .instructions {
      font-size: 22px; font-weight: bold;
      margin-bottom: 16px; letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .steps {
      font-size: 17px; line-height: 2;
      color: #333; margin-bottom: 32px;
      list-style: none;
    }
    .steps li::before { content: "→ "; font-weight: bold; }
    .url {
      font-size: 13px; color: #888;
      font-family: monospace; margin-top: 24px;
    }
    .divider {
      width: 60px; height: 3px;
      background: #111; margin: 28px auto;
      border-radius: 2px;
    }
    @media print {
      body { padding: 20px; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>
  <div class="show-title">${title}</div>
  ${venue ? `<div class="venue">${venue}</div>` : '<div style="margin-bottom:40px"></div>'}
  <div class="qr-wrapper">
    <img src="${qrUrl}" alt="Check-in QR Code" />
  </div>
  <div class="instructions">Scan to check in</div>
  <ul class="steps">
    <li>Open your phone camera</li>
    <li>Point it at the QR code</li>
    <li>Tap your name</li>
  </ul>
  <div class="divider"></div>
  <div class="url">${url}</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=700,height=900')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
}

export default function CheckinTab({ sheetId, productionCode, production, session }) {
  const today = new Date().toLocaleDateString('en-CA') // en-CA gives YYYY-MM-DD in local time
  const [date, setDate] = useState(today)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const pollRef = useRef(null)

  const checkinUrl = `${window.location.origin}/checkin/${productionCode}/${date}`
  const permanentUrl = `${window.location.origin}/checkin/${productionCode}`

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [sheetId, date])

  async function load() {
    try {
      const data = await api.getCheckinStatus(sheetId, date)
      setStatus(data)
    } catch (e) { console.warn(e) }
    finally { setLoading(false) }
  }

  const castList = (status?.castList || []).map(c =>
    typeof c === 'string' ? { name: c, castMember: '' } : c
  )
  const checkins = status?.checkins || []
  const checkedInNames = new Set(checkins.map(c => c.castName))
  const notIn = castList.filter(c => !checkedInNames.has(c.name))
  const pct = castList.length ? Math.round((checkedInNames.size / castList.length) * 100) : 0

  const isShowDate = (() => {
    const showDates = production?.config?.showDates || ''
    if (!showDates) return false
    try {
      const yearMatch = showDates.match(/\b(20\d{2})\b/)
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
      const sameMonth = showDates.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*(\d+)/)
      if (sameMonth) {
        const [, month, d1, d2] = sameMonth
        const start = new Date(`${month} ${d1}, ${year}`)
        const end = new Date(`${month} ${d2}, ${year}`)
        const check = new Date(date + 'T00:00:00')
        return check >= start && check <= end
      }
    } catch {}
    return false
  })()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ fontSize: 13, padding: '5px 8px' }} />
        </div>
        {isShowDate && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
            background: 'var(--amber-bg)', color: 'var(--amber-text)', marginTop: 14 }}>
            🎬 Show date
          </span>
        )}
        <button className="btn btn-sm" onClick={load} style={{ marginTop: 14 }}>↻ Refresh</button>
      </div>

      {/* Progress */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{checkedInNames.size} / {castList.length} checked in</p>
          <span style={{ fontSize: 14, fontWeight: 600, color: pct === 100 ? 'var(--green-text)' : pct > 75 ? 'var(--amber-text)' : 'var(--red-text)' }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, transition: 'width 0.5s',
            width: `${pct}%`,
            background: pct === 100 ? 'var(--green-text)' : pct > 75 ? 'var(--amber-text)' : 'var(--red-text)'
          }} />
        </div>
        {pct === 100 && <p style={{ fontSize: 12, color: 'var(--green-text)', marginTop: 6, fontWeight: 500 }}>✅ Everyone's in!</p>}
      </div>

      {/* Permanent QR — print this one */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: 14, border: '1.5px solid var(--green-text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-text)', marginBottom: 2 }}>🖨️ Permanent QR — print this one</p>
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>Always redirects to today's date automatically</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(permanentUrl)} style={{ fontSize: 11 }}>Copy</button>
            <button className="btn btn-sm" onClick={() => setShowQR(q => !q)} style={{ fontSize: 11 }}>{showQR ? 'Hide QR' : 'Show QR'}</button>
          </div>
        </div>
        {showQR && (
          <div style={{ textAlign: 'center' }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(permanentUrl)}`}
              alt="Permanent check-in QR" style={{ width: 200, height: 200, borderRadius: 8 }} />
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, fontWeight: 500 }}>{permanentUrl}</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Print once, hang in theatre — works every rehearsal and show night
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
              <button className="btn btn-sm"
                onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(permanentUrl)}`, '_blank')}>
                Download high-res QR
              </button>
              <button className="btn btn-sm"
                onClick={() => printCheckinPage(production?.config?.title || 'Production', permanentUrl, production?.config?.venue || '')}>
                🖨️ Print sign
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Today's specific link */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>🔗 Today's direct link</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', wordBreak: 'break-all' }}>{checkinUrl}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(checkinUrl)} style={{ fontSize: 11 }}>Copy</button>
            <button className="btn btn-sm" onClick={() => window.open(checkinUrl, '_blank')} style={{ fontSize: 11 }}>Open</button>
          </div>
        </div>
      </div>

      {/* Custom alert */}
      <CustomAlertPanel sheetId={sheetId} production={production} isShowDay={isShowDate} />

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            ⚠ Not in ({notIn.length})
          </p>
          {notIn.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>Everyone's in! 🎉</p>
            : notIn.map(c => (
              <div key={c.name} style={{ padding: '7px 10px', marginBottom: 4, borderRadius: 'var(--radius)',
                background: 'var(--red-bg)', border: '0.5px solid var(--red-text)', fontSize: 13, color: 'var(--red-text)' }}>
                <span style={{ fontWeight: 500 }}>{c.castMember || c.name}</span>
                {c.castMember && <span style={{ fontSize: 11, opacity: 0.8, display: 'block' }}>{c.name}</span>}
              </div>
            ))
          }
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            ✅ In ({checkedInNames.size})
          </p>
          {checkins.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>No check-ins yet</p>
            : checkins.map(c => (
              <div key={c.castName} style={{ padding: '7px 10px', marginBottom: 4, borderRadius: 'var(--radius)',
                background: 'var(--bg2)', border: '0.5px solid var(--border)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{c.castName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {new Date(c.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {c.note && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.note}</p>}
              </div>
            ))
          }
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 16 }}>Auto-refreshes every 20s</p>
    </div>
  )
}
