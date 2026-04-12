import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const POLL_INTERVAL = 20000 // 20 seconds

export default function ShowDayTab({ sheetId, productionCode, production, session }) {
  const today = new Date().toISOString().slice(0, 10)
  const [showDate, setShowDate] = useState(today)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alerting, setAlerting] = useState(false)
  const [alertResult, setAlertResult] = useState(null)
  const [curtainTime, setCurtainTime] = useState('')
  const [alertMinutes, setAlertMinutes] = useState(30)
  const [showQR, setShowQR] = useState(false)
  const pollRef = useRef(null)

  const checkinUrl = `${window.location.origin}/checkin/${productionCode}/${showDate}`

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [sheetId, showDate])

  async function load() {
    try {
      const data = await api.getCheckinStatus(sheetId, showDate)
      setStatus(data)
      if (data.curtainTime && !curtainTime) setCurtainTime(data.curtainTime)
    } catch (e) { console.warn('Failed to load checkins:', e.message) }
    finally { setLoading(false) }
  }

  async function sendAlerts() {
    setAlerting(true)
    setAlertResult(null)
    try {
      const result = await api.sendCheckinAlerts({ sheetId, showDate, curtainTime, alertMinutes })
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
  const missingCast = castList.filter(n => !checkedInNames.has(n))
  const pct = castList.length ? Math.round((checkedInNames.size / castList.length) * 100) : 0

  return (
    <div>
      {/* Header controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, flex: '0 0 auto' }}>
          <label style={{ fontSize: 11 }}>Show date</label>
          <input type="date" value={showDate} onChange={e => setShowDate(e.target.value)}
            style={{ fontSize: 13, padding: '5px 8px' }} />
        </div>
        <div className="field" style={{ margin: 0, flex: '0 0 auto' }}>
          <label style={{ fontSize: 11 }}>Curtain time</label>
          <input type="time" value={curtainTime} onChange={e => setCurtainTime(e.target.value)}
            style={{ fontSize: 13, padding: '5px 8px', width: 110 }} />
        </div>
        <div className="field" style={{ margin: 0, flex: '0 0 auto' }}>
          <label style={{ fontSize: 11 }}>Alert if not in by</label>
          <select value={alertMinutes} onChange={e => setAlertMinutes(Number(e.target.value))}
            style={{ fontSize: 13, padding: '5px 8px' }}>
            {[15,20,30,45,60].map(m => <option key={m} value={m}>{m} min before curtain</option>)}
          </select>
        </div>
        <button className="btn btn-sm" onClick={load} style={{ marginTop: 14 }}>↻ Refresh</button>
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
        {pct === 100 && (
          <p style={{ fontSize: 12, color: 'var(--green-text)', marginTop: 6, fontWeight: 500 }}>✅ Full house — everyone's in!</p>
        )}
      </div>

      {/* QR Code + URL */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>📱 Cast check-in link</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', wordBreak: 'break-all' }}>{checkinUrl}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(checkinUrl) }}
              style={{ fontSize: 11 }}>Copy</button>
            <button className="btn btn-sm" onClick={() => setShowQR(q => !q)}
              style={{ fontSize: 11 }}>QR</button>
          </div>
        </div>
        {showQR && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkinUrl)}`}
              alt="Check-in QR code"
              style={{ width: 180, height: 180, borderRadius: 8 }}
            />
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Display at stage door</p>
          </div>
        )}
      </div>

      {/* Alert button */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={sendAlerts} disabled={alerting || missingCast.length === 0}
          style={{ flex: 1 }}>
          {alerting ? 'Sending alerts…' : `📱 Alert ${missingCast.length} missing cast`}
        </button>
      </div>

      {alertResult && (
        <div style={{
          background: alertResult.error ? 'var(--red-bg)' : 'var(--bg2)',
          border: `0.5px solid ${alertResult.error ? 'var(--red-text)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: 16, fontSize: 13
        }}>
          {alertResult.error ? (
            <p style={{ color: 'var(--red-text)' }}>⚠ {alertResult.error}</p>
          ) : (
            <>
              {alertResult.alerted?.length > 0 && <p style={{ color: 'var(--green-text)', marginBottom: 4 }}>✓ Alerted: {alertResult.alerted.join(', ')}</p>}
              {alertResult.failed?.length > 0 && <p style={{ color: 'var(--red-text)' }}>✗ Failed: {alertResult.failed.map(f => f.name).join(', ')}</p>}
              {alertResult.alerted?.length === 0 && alertResult.failed?.length === 0 && (
                <p style={{ color: 'var(--text2)' }}>No SMS numbers configured for staff. Add phone numbers in Setup → Characters.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Two columns: Missing | Present */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Missing */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            ⚠ Missing ({missingCast.length})
          </p>
          {missingCast.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Everyone's in! 🎉</p>
          ) : missingCast.map(name => (
            <div key={name} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius)', background: 'var(--red-bg)', border: '0.5px solid var(--red-text)', fontSize: 13, color: 'var(--red-text)' }}>
              {name}
            </div>
          ))}
        </div>

        {/* Present */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            ✅ Present ({checkedInNames.size})
          </p>
          {checkins.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No check-ins yet</p>
          ) : checkins.map(c => (
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
