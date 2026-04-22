import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { getTimelineRemote } from '../lib/showTimeline'
import CustomAlertPanel from './CustomAlertPanel'

// ── Confetti ─────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#fb923c', '#e879f9', '#4ade80', '#38bdf8', '#f87171']

    particlesRef.current = Array.from({ length: 350 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 300,
      w: 7 + Math.random() * 10,
      h: 12 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 1.2 + Math.random() * 2.5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.15,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.05,
      wobbleAmp: 1 + Math.random() * 2,
      opacity: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      particlesRef.current.forEach(p => {
        p.wobble += p.wobbleSpeed
        p.x += p.vx + Math.sin(p.wobble) * p.wobbleAmp
        p.y += p.vy
        p.angle += p.spin
        p.vy += 0.02 // very gentle gravity

        if (p.y < canvas.height + 20) {
          alive = true
          // Fade out in the bottom 30% of screen
          p.opacity = p.y > canvas.height * 0.7
            ? Math.max(0, 1 - (p.y - canvas.height * 0.7) / (canvas.height * 0.3))
            : 1
        }

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color

        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        }
        ctx.restore()
      })
      if (alive) animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [active])

  if (!active) return null
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }} />
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMs(ms) {
  if (!ms) return '—'
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function isAfterShowDates(showDates) {
  if (!showDates) return false
  try {
    const today = new Date(); today.setHours(0,0,0,0)
    const str = showDates.trim()
    const yearMatch = str.match(/\b(20\d{2})\b/)
    const year = yearMatch ? parseInt(yearMatch[1]) : today.getFullYear()
    // Find the last date in the range
    const sameMonthRange = str.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*(\d+)/)
    if (sameMonthRange) {
      const [, month, , d2] = sameMonthRange
      const end = new Date(`${month} ${d2}, ${year}`); end.setHours(0,0,0,0)
      return today > end
    }
    const crossMonthRange = str.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*([A-Za-z]+)\s+(\d+)/)
    if (crossMonthRange) {
      const [, , , m2, d2] = crossMonthRange
      const end = new Date(`${m2} ${d2}, ${year}`); end.setHours(0,0,0,0)
      return today > end
    }
    const single = new Date(str); single.setHours(0,0,0,0)
    if (!isNaN(single)) return today > single
  } catch {}
  return false
}

export { isAfterShowDates }

export default function ProductionClosed({ production, session, notes, sheetId, onReopen }) {
  const [timelines, setTimelines] = useState({})
  const [loadingTimelines, setLoadingTimelines] = useState(true)
  const [sendingReport, setSendingReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [closingMessage, setClosingMessage] = useState('')
  const [alertResult, setAlertResult] = useState(null)

  const isAdmin = session?.role === 'admin'

  // Confetti — show for 5 days after close, once per login session
  const confettiKey = `rn_confetti_${sheetId}`
  const [showConfetti, setShowConfetti] = useState(() => {
    try {
      const last = localStorage.getItem(confettiKey)
      if (!last) return true
      const daysSince = (Date.now() - parseInt(last)) / (1000 * 60 * 60 * 24)
      return daysSince <= 5
    } catch { return true }
  })

  useEffect(() => {
    if (showConfetti) {
      try { localStorage.setItem(confettiKey, String(Date.now())) } catch {}
      const t = setTimeout(() => setShowConfetti(false), 8000)
      return () => clearTimeout(t)
    }
  }, [])

  const curtainTimes = (() => {
    const raw = production?.config?.curtainTimes
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return {} }
  })()

  const showDates = Object.keys(curtainTimes).sort()

  // Fetch all timelines
  useEffect(() => {
    if (!showDates.length) { setLoadingTimelines(false); return }
    Promise.all(showDates.map(async date => {
      const { timeline } = await getTimelineRemote(sheetId, date)
      return [date, timeline]
    })).then(results => {
      const map = {}
      results.forEach(([date, t]) => { if (t) map[date] = t })
      setTimelines(map)
      setLoadingTimelines(false)
    })
  }, [sheetId])

  // Notes stats
  const totalNotes = notes.length
  const resolvedNotes = notes.filter(n => n.resolved).length
  const openNotes = notes.filter(n => !n.resolved).length

  const byCategory = {}
  notes.forEach(n => {
    const cat = n.category || 'general'
    byCategory[cat] = (byCategory[cat] || 0) + 1
  })

  const byDepartment = {}
  notes.forEach(n => {
    const cast = n.cast || ''
    const tags = cast.split(',').map(s => s.trim()).filter(s => s.startsWith('#'))
    if (tags.length) {
      tags.forEach(tag => { byDepartment[tag] = (byDepartment[tag] || 0) + 1 })
    } else if (n.cast) {
      byDepartment['cast'] = (byDepartment['cast'] || 0) + 1
    }
  })

  // Run data
  const runRows = showDates.map((date, i) => {
    const t = timelines[date]
    if (!t || t.phase !== 'done') return { date, perf: i + 1, label: fmtDate(date), times: null }
    const a1 = t.act1Start && t.act1End ? new Date(t.act1End) - new Date(t.act1Start) : 0
    const int = t.intermissionStart && t.intermissionEnd ? new Date(t.intermissionEnd) - new Date(t.intermissionStart) : 0
    const a2 = t.act2Start && t.act2End ? new Date(t.act2End) - new Date(t.act2Start) : 0
    return { date, perf: i + 1, label: fmtDate(date), times: { a1, int, a2, total: a1 + int + a2 } }
  })
  const completedRuns = runRows.filter(r => r.times)

  // Averages
  const avgTotal = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.total, 0) / completedRuns.length : 0
  const avgInt = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.int, 0) / completedRuns.length : 0
  const avgA1 = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.a1, 0) / completedRuns.length : 0
  const avgA2 = completedRuns.length ? completedRuns.reduce((s, r) => s + r.times.a2, 0) / completedRuns.length : 0

  const [reportRecipients, setReportRecipients] = useState(null)

  async function sendCloseoutReport() {
    setSendingReport(true)
    try {
      const res = await api.call('/sendCloseoutReport', 'POST', {
        sheetId,
        allTimelines: timelines,
        closingNote: closingMessage,
        productionCode: production?.productionCode,
      })
      setReportSent(true)
      if (res.recipients) setReportRecipients(res.recipients)
    } catch (e) { console.warn('Closeout report failed:', e) }
    finally { setSendingReport(false) }
  }

  async function toggleClosed() {
    const next = production?.config?.productionClosed === 'true' ? 'false' : 'true'
    await api.updateProduction({ sheetId, config: { productionClosed: next } })
    if (next === 'false') onReopen?.()
  }

  const title = production?.config?.title || 'Production'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem 1.5rem 6rem', maxWidth: 800, margin: '0 auto' }}>
      <Confetti active={showConfetti} />

      {/* Escape hatch */}
      {isAdmin && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <button className="btn btn-sm" onClick={onReopen}
            style={{ fontSize: 12, color: 'var(--text3)', background: 'transparent', borderColor: 'var(--border)' }}>
            ← Back to production
          </button>
        </div>
      )}

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎭</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 6px', color: 'var(--text)' }}>{title}</h1>
        <p style={{ fontSize: 15, color: 'var(--text3)', margin: '0 0 4px' }}>
          {production?.config?.showDates} · {completedRuns.length} performance{completedRuns.length !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'inline-block', background: 'var(--green-bg)', color: 'var(--green-text)', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
          🎉 What a run!
        </div>
      </div>

      {/* Notes summary */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 12 }}>📝 Notes Summary</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Total', value: totalNotes, color: 'var(--text)' },
            { label: 'Resolved', value: resolvedNotes, color: 'var(--green-text)' },
            { label: 'Open', value: openNotes, color: openNotes > 0 ? 'var(--amber-text)' : 'var(--text3)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* By category */}
        {Object.keys(byCategory).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>BY CATEGORY</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '4px 10px', fontSize: 12 }}>
                  <span style={{ color: 'var(--text2)' }}>{cat}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By department */}
        {Object.keys(byDepartment).length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>BY DEPARTMENT</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(byDepartment).sort((a,b) => b[1]-a[1]).map(([dept, count]) => (
                <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '4px 10px', fontSize: 12 }}>
                  <span style={{ color: 'var(--blue-text)', fontWeight: 500 }}>{dept}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Run history */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 12 }}>⏱ Run Times</p>
        {loadingTimelines ? (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Loading performance data…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '4px 12px', alignItems: 'center' }}>
              {['Performance', 'Act 1', 'Int.', 'Act 2', 'Total'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h !== 'Performance' ? 'right' : 'left', paddingBottom: 4, borderBottom: '0.5px solid var(--border)' }}>{h}</div>
              ))}
              {runRows.map(row => (
                <>
                  <div key={row.date + 'label'} style={{ fontSize: 12, color: 'var(--text2)', paddingTop: 4 }}>{row.label}</div>
                  <div key={row.date + 'a1'} style={{ fontSize: 13, fontWeight: 500, color: row.times ? 'var(--text)' : 'var(--text3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs(row.times.a1) : '—'}</div>
                  <div key={row.date + 'int'} style={{ fontSize: 13, fontWeight: 500, color: row.times ? (row.times.int > 15*60*1000 ? 'var(--red-text)' : 'var(--text)') : 'var(--text3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs(row.times.int) : '—'}</div>
                  <div key={row.date + 'a2'} style={{ fontSize: 13, fontWeight: 500, color: row.times ? 'var(--text)' : 'var(--text3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs(row.times.a2) : '—'}</div>
                  <div key={row.date + 'total'} style={{ fontSize: 13, fontWeight: 700, color: row.times ? 'var(--text)' : 'var(--text3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs(row.times.total) : '—'}</div>
                </>
              ))}
              {completedRuns.length > 1 && <>
                <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>Average</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right', borderTop: '0.5px solid var(--border)', paddingTop: 8, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(avgA1)}</div>
                <div style={{ fontSize: 12, color: avgInt > 15*60*1000 ? 'var(--red-text)' : 'var(--text3)', textAlign: 'right', borderTop: '0.5px solid var(--border)', paddingTop: 8, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(avgInt)}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right', borderTop: '0.5px solid var(--border)', paddingTop: 8, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(avgA2)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textAlign: 'right', borderTop: '0.5px solid var(--border)', paddingTop: 8, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(avgTotal)}</div>
              </>}
            </div>
          </>
        )}
      </div>

      {/* Closeout message + alerts */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 12 }}>📢 Send Closeout Message</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {['Thank you for an incredible run! 🎭', 'Strike call — all hands! 🔧', 'Congratulations on a fantastic show! 🎉', 'Thank you cast and crew — what a show! ⭐'].map(q => (
            <button key={q} className="btn btn-sm" onClick={() => setClosingMessage(q)}
              style={{ fontSize: 11, background: closingMessage === q ? 'var(--bg3)' : 'transparent' }}>{q}</button>
          ))}
        </div>
        <textarea rows={3} value={closingMessage} onChange={e => setClosingMessage(e.target.value)}
          placeholder="Type a custom closeout message…"
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, resize: 'none', marginBottom: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: '📧 Email Staff', target: 'staff', bg: 'var(--blue-bg)', color: 'var(--blue-text)' },
            { label: '⚠ Alert Cast', target: 'cast', bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
            { label: '🔔 Alert All', target: 'all', bg: 'var(--red-bg)', color: 'var(--red-text)' },
          ].map(({ label, target, bg, color }) => (
            <button key={target} className="btn btn-sm" disabled={!closingMessage.trim()}
              onClick={async () => {
                try {
                  const res = await api.sendCustomAlert({ sheetId, message: closingMessage, alertTarget: target, useEmail: target === 'staff' || target === 'all' })
                  setAlertResult(res)
                } catch (e) { setAlertResult({ error: e.message }) }
              }}
              style={{ background: bg, color, borderColor: 'transparent', fontWeight: 500, fontSize: 12 }}>
              {label}
            </button>
          ))}
        </div>
        {alertResult && (
          <div style={{ marginTop: 8, fontSize: 12, padding: '6px 10px', background: alertResult.error ? 'var(--red-bg)' : 'var(--green-bg)', borderRadius: 'var(--radius)', color: alertResult.error ? 'var(--red-text)' : 'var(--green-text)' }}>
            {alertResult.error ? `✗ ${alertResult.error}` : `✓ Sent to: ${alertResult.alerted?.join(', ')}`}
          </div>
        )}
      </div>

      {/* Final report email */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 4 }}>📧 Final Show Report</p>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Send a full-run summary email to the SM and Director.</p>
        {reportSent ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--green-text)', fontWeight: 500, marginBottom: 4 }}>✅ Final report sent!</p>
            {reportRecipients && (
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Sent to: {reportRecipients.join(', ')}
              </p>
            )}
          </div>
        ) : (
          <button className="btn btn-primary btn-full" onClick={sendCloseoutReport} disabled={sendingReport}>
            {sendingReport ? 'Sending…' : '📧 Send final show report'}
          </button>
        )}
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 8 }}>⚙️ Admin</p>
          <button className="btn btn-full" onClick={toggleClosed}
            style={{ background: 'var(--amber-bg)', color: 'var(--amber-text)', borderColor: 'transparent', fontWeight: 500 }}>
            {production?.config?.productionClosed === 'true' ? '🔓 Reopen production' : '🔒 Close production'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
            {production?.config?.productionClosed === 'true'
              ? 'Reopening will restore the normal app view for all users.'
              : 'Closing will show this screen to all users when they log in.'}
          </p>
        </div>
      )}
    </div>
  )
}
