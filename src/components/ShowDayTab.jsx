import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const POLL_INTERVAL = 20000

// Parse "HH:MM" into today's Date object
function todayAt(timeStr, dateStr) {
  if (!timeStr || !dateStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(h, m, 0, 0)
  return d
}

// Minutes until a given Date from now
function minutesUntil(target) {
  if (!target) return null
  return Math.round((target - new Date()) / 60000)
}

export default function ShowDayTab({ sheetId, productionCode, production, session, showDayMode, onGoToCheckin }) {
  const [now, setNow] = useState(new Date())
  const [showDate, setShowDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alerting, setAlerting] = useState(false)
  const [alertResult, setAlertResult] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [autoAlertFired, setAutoAlertFired] = useState(false)
  const pollRef = useRef(null)
  const autoAlertRef = useRef(null)

  // Curtain times per day — stored in config as JSON: {"2026-04-16":"19:00","2026-04-17":"19:00",...}
  const curtainTimes = (() => {
    const raw = production?.config?.curtainTimes
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return {} }
  })()
  const [curtainTime, setCurtainTime] = useState(curtainTimes[showDate] || '')

  // Update curtain time when date changes
  useEffect(() => {
    setCurtainTime(curtainTimes[showDate] || '')
    setAutoAlertFired(false)
  }, [showDate, production])

  // Ticking clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll checkins
  useEffect(() => {
    load()
    pollRef.current = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [sheetId, showDate])

  // Auto-alert at 1 hour before curtain
  useEffect(() => {
    if (!curtainTime || !showDate || autoAlertFired) return
    clearTimeout(autoAlertRef.current)
    const curtain = todayAt(curtainTime, showDate)
    if (!curtain) return
    const alertAt = new Date(curtain.getTime() - 60 * 60000) // 1 hour before
    const msUntilAlert = alertAt - new Date()
    if (msUntilAlert <= 0) return // already past
    autoAlertRef.current = setTimeout(async () => {
      setAutoAlertFired(true)
      try {
        await api.sendCheckinAlerts({ sheetId, showDate, curtainTime, alertMinutes: 60, autoFired: true })
        console.log('Auto curtain alert sent')
      } catch (e) { console.warn('Auto alert failed:', e.message) }
    }, msUntilAlert)
    return () => clearTimeout(autoAlertRef.current)
  }, [curtainTime, showDate, autoAlertFired])

  async function load() {
    try {
      const data = await api.getCheckinStatus(sheetId, showDate)
      setStatus(data)
    } catch (e) { console.warn('Failed to load checkins:', e.message) }
    finally { setLoading(false) }
  }

  async function saveCurtainTime(date, time) {
    const updated = { ...curtainTimes, [date]: time }
    try {
      await api.updateProduction({ sheetId, config: { curtainTimes: JSON.stringify(updated) } })
    } catch (e) { console.warn('Failed to save curtain time:', e.message) }
  }

  async function sendAlerts() {
    setAlerting(true)
    setAlertResult(null)
    try {
      const result = await api.sendCheckinAlerts({ sheetId, showDate, curtainTime, alertMinutes: 60 })
      setAlertResult(result)
    } catch (e) {
      setAlertResult({ error: e.message })
    } finally {
      setAlerting(false)
    }
  }

  const castList = status?.castList || []
  const checkins = status?.checkins || []
  const checkedInNames = new Set(checkins.map(c => c.castName))
  // castList may be objects {name, castMember} or plain strings
  const missingCast = castList.filter(c => {
    const n = typeof c === 'string' ? c : c.name
    return !checkedInNames.has(n)
  })
  const pct = castList.length ? Math.round((checkedInNames.size / castList.length) * 100) : 0
  const checkinUrl = `${window.location.origin}/checkin/${productionCode}/${showDate}`
  const curtain = todayAt(curtainTime, showDate)
  const minsUntil = minutesUntil(curtain)
  const isPast = minsUntil !== null && minsUntil < 0

  // Countdown display
  function countdownLabel() {
    if (!curtainTime) return null
    if (isPast) return { text: 'Show is on! 🎭', color: 'var(--green-text)' }
    if (minsUntil <= 15) return { text: `${minsUntil} min to curtain ⚡`, color: 'var(--red-text)' }
    if (minsUntil <= 30) return { text: `${minsUntil} min to curtain ⚠️`, color: 'var(--amber-text)' }
    if (minsUntil <= 60) return { text: `${minsUntil} min to curtain`, color: 'var(--amber-text)' }
    const h = Math.floor(minsUntil / 60)
    const m = minsUntil % 60
    return { text: `${h}h ${m}m to curtain`, color: 'var(--text2)' }
  }
  const countdown = countdownLabel()

  return (
    <div>
      {/* Show Day mode banner with clock */}
      {showDayMode && (
        <div style={{
          background: isPast ? 'var(--green-text)' : 'var(--amber-text)',
          color: 'var(--bg)', padding: '10px 16px', marginBottom: 16,
          borderRadius: 'var(--radius)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              {isPast ? '🎭 Show is running!' : '🎬 Show Day'}
            </p>
            <p style={{ fontSize: 12, margin: 0, opacity: 0.85 }}>{production?.config?.title}</p>
            {autoAlertFired && <p style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.8 }}>✓ 1-hour alert sent</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </div>
            {curtainTime && (
              <div style={{ fontSize: 11, opacity: 0.85 }}>Curtain {curtainTime}</div>
            )}
          </div>
        </div>
      )}

      {/* Date + Curtain Time */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, flex: '0 0 auto' }}>
            <label style={{ fontSize: 11 }}>Show date</label>
            <input type="date" value={showDate}
              onChange={e => setShowDate(e.target.value)}
              style={{ fontSize: 13, padding: '5px 8px' }} />
          </div>
          <div className="field" style={{ margin: 0, flex: '0 0 auto' }}>
            <label style={{ fontSize: 11 }}>
              Curtain time
              {curtainTimes[showDate] && <span style={{ color: 'var(--green-text)', marginLeft: 4 }}>✓ saved</span>}
            </label>
            <input type="time" value={curtainTime}
              onChange={e => {
                setCurtainTime(e.target.value)
                setAutoAlertFired(false)
              }}
              onBlur={e => { if (e.target.value) saveCurtainTime(showDate, e.target.value) }}
              style={{ fontSize: 13, padding: '5px 8px', width: 110 }} />
          </div>
          {countdown && (
            <div style={{ paddingBottom: 6, flex: '0 0 auto' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: countdown.color, margin: 0 }}>
                {countdown.text}
              </p>
            </div>
          )}
          <button className="btn btn-sm" onClick={load} style={{ marginBottom: 2, marginLeft: 'auto' }}>↻</button>
        </div>

        {curtainTime && !isPast && minsUntil !== null && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)' }}>
            {minsUntil > 60
              ? `📱 Auto SMS alert will fire in ${Math.floor((minsUntil - 60))}h ${(minsUntil - 60) % 60}m (1 hour before curtain)`
              : minsUntil <= 60 && !autoAlertFired
              ? '📱 Auto SMS alert firing within the hour…'
              : '✓ Auto alert sent'}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            {checkedInNames.size} / {castList.length} checked in
          </p>
          <span style={{ fontSize: 14, fontWeight: 600, color: pct === 100 ? 'var(--green-text)' : pct > 75 ? 'var(--amber-text)' : 'var(--red-text)' }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.5s',
            width: `${pct}%`,
            background: pct === 100 ? 'var(--green-text)' : pct > 75 ? 'var(--amber-text)' : 'var(--red-text)'
          }} />
        </div>
        {pct === 100
          ? <p style={{ fontSize: 12, color: 'var(--green-text)', marginTop: 6, fontWeight: 500 }}>✅ Full house — everyone's in!</p>
          : castList.length > 0 && <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{missingCast.length} still needed</p>
        }
      </div>

      {/* Go to Check-in */}
      <button
        onClick={onGoToCheckin}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '0.875rem 1rem', marginBottom: 14,
          background: 'var(--bg2)', border: '0.5px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--text)'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Cast Check-in</p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>QR code, live list, manual check-in</p>
          </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--text3)' }}>→</span>
      </button>

      {/* QR Code */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>📱 Cast check-in link</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', wordBreak: 'break-all' }}>{checkinUrl}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(checkinUrl)} style={{ fontSize: 11 }}>Copy</button>
            <button className="btn btn-sm" onClick={() => setShowQR(q => !q)} style={{ fontSize: 11 }}>QR</button>
          </div>
        </div>
        {showQR && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkinUrl)}`}
              alt="Check-in QR code" style={{ width: 180, height: 180, borderRadius: 8 }} />
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Display at stage door</p>
          </div>
        )}
      </div>

      {/* Manual alert button */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary btn-full" onClick={sendAlerts} disabled={alerting}>
          {alerting ? 'Sending…' : missingCast.length === 0
            ? '📱 Send "All clear" SMS to stage manager'
            : `📱 Alert stage manager — ${missingCast.length} missing`}
        </button>
        {alertResult && (
          <div style={{
            marginTop: 8, padding: '0.75rem',
            background: alertResult.error ? 'var(--red-bg)' : 'var(--bg2)',
            border: `0.5px solid ${alertResult.error ? 'var(--red-text)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', fontSize: 13
          }}>
            {alertResult.error
              ? <p style={{ color: 'var(--red-text)' }}>⚠ {alertResult.error}</p>
              : <>
                {alertResult.alerted?.length > 0 && <p style={{ color: 'var(--green-text)', marginBottom: 2 }}>✓ Alerted: {alertResult.alerted.join(', ')}</p>}
                {alertResult.failed?.length > 0 && <p style={{ color: 'var(--red-text)' }}>✗ Failed: {alertResult.failed.map(f => f.name).join(', ')}</p>}
                {!alertResult.alerted?.length && !alertResult.failed?.length && (
                  <p style={{ color: 'var(--text2)' }}>No SMS numbers on file for staff. Add them in Setup → Characters.</p>
                )}
              </>
            }
          </div>
        )}
      </div>

      {/* Two columns: Missing | Present */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            ⚠ Missing ({missingCast.length})
          </p>
          {missingCast.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>Everyone's in! 🎉</p>
            : missingCast.map(c => {
              const roleName = typeof c === 'string' ? c : c.name
              const actorName = typeof c === 'object' && c.castMember ? c.castMember : null
              return (
                <div key={roleName} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius)', background: 'var(--red-bg)', border: '0.5px solid var(--red-text)', fontSize: 13, color: 'var(--red-text)' }}>
                  <span style={{ fontWeight: 500 }}>{actorName || roleName}</span>
                  {actorName && <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 6 }}>{roleName}</span>}
                </div>
              )
            })
          }}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            ✅ Present ({checkedInNames.size})
          </p>
          {checkins.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>No check-ins yet</p>
            : checkins.map(c => (
              <div key={c.castName} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius)', background: 'var(--bg2)', border: '0.5px solid var(--border)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontWeight: 500 }}>{c.castName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {new Date(c.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {c.note && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.note}</p>}
              </div>
            ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 16 }}>
        Auto-refreshes every 20 seconds
      </p>
    </div>
  )
}
