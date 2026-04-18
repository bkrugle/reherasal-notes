import React, { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import CustomAlertPanel from './CustomAlertPanel'
import { getTimeline, saveTimeline, saveTimelineRemote, getTimelineRemote, defaultTimeline, fmtElapsed, elapsedMs } from '../lib/showTimeline'

const POLL_INTERVAL = 20000
const TIMELINE_POLL_INTERVAL = 5000
const INTERMISSION_STANDARD = 15 * 60 * 1000 // 15 min

function todayAt(timeStr, dateStr) {
  if (!timeStr || !dateStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(h, m, 0, 0)
  return d
}

function secsUntil(target) {
  if (!target) return null
  return Math.round((target - new Date()) / 1000)
}

function fmtCountdown(totalSec) {
  const abs = Math.abs(totalSec)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function parseTimeToISO(timeStr, dateStr) {
  if (!timeStr || !dateStr) return null
  try {
    const t = new Date(`${dateStr}T00:00:00`)
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
    if (!match) return null
    let h = parseInt(match[1])
    const m = parseInt(match[2])
    const ampm = match[3]?.toUpperCase()
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    t.setHours(h, m, 0, 0)
    return t.toISOString()
  } catch { return null }
}

export default function ShowDayTab({ sheetId, productionCode, production, session, showDayMode, onGoToCheckin }) {
  const [now, setNow] = useState(new Date())
  const [showDate, setShowDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alerting, setAlerting] = useState(false)
  const [alertResult, setAlertResult] = useState(null)
  const [showQR, setShowQR] = useState(false)

  const curtainTimes = (() => {
    const raw = production?.config?.curtainTimes
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return {} }
  })()
  const [curtainTime, setCurtainTime] = useState(curtainTimes[showDate] || '')

  const [timeline, setTimeline] = useState(defaultTimeline)
  const [lockedBy, setLockedBy] = useState(null)
  const [manualEntry, setManualEntry] = useState(false)
  const [savingTimeline, setSavingTimeline] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [manualForm, setManualForm] = useState({ act1Start: '', act1End: '', intermissionStart: '', intermissionEnd: '', act2Start: '', act2End: '' })
  const timelinePollRef = useRef(null)

  const isSM = session?.staffRole === 'Stage Manager'
  const isController = isSM && (!lockedBy || lockedBy === session?.name)

  async function updateTimeline(changes) {
    if (savingTimeline) return
    setSavingTimeline(true)
    try {
      const next = { ...timeline, ...changes }
      if (!next.lockedBy && isSM) next.lockedBy = session.name
      setTimeline(next)
      setLockedBy(next.lockedBy || null)
      await saveTimelineRemote(sheetId, showDate, next)
    } finally {
      setSavingTimeline(false)
    }
  }

  async function resetTimeline() {
    if (!confirm('Reset the show timeline? This clears act timers for today.')) return
    const fresh = defaultTimeline()
    setTimeline(fresh)
    setLockedBy(null)
    await saveTimelineRemote(sheetId, showDate, fresh)
  }

  async function applyManualEntry() {
    const mf = manualForm
    const act1Start = parseTimeToISO(mf.act1Start, showDate)
    const act1End = parseTimeToISO(mf.act1End, showDate)
    const intermissionStart = parseTimeToISO(mf.intermissionStart, showDate)
    const intermissionEnd = parseTimeToISO(mf.intermissionEnd, showDate)
    const act2Start = parseTimeToISO(mf.act2Start, showDate)
    const act2End = parseTimeToISO(mf.act2End, showDate)
    const phase = act2End ? 'done' : act2Start ? 'act2' : intermissionEnd ? 'act2' : intermissionStart ? 'intermission' : act1Start ? 'act1' : 'preshow'
    const next = { ...timeline, phase, act1Start, act1End: act1End || intermissionStart, intermissionStart, intermissionEnd: intermissionEnd || act2Start, act2Start, act2End }
    setTimeline(next)
    setLockedBy(next.lockedBy || null)
    await saveTimelineRemote(sheetId, showDate, next)
    setManualEntry(false)
  }

  useEffect(() => {
    async function pollTimeline() {
      const { timeline: remote, lockedBy: lb } = await getTimelineRemote(sheetId, showDate)
      if (remote) {
        setTimeline(remote)
        setLockedBy(lb || null)
        saveTimeline(sheetId, showDate, remote)
      }
    }
    pollTimeline()
    timelinePollRef.current = setInterval(pollTimeline, TIMELINE_POLL_INTERVAL)
    return () => clearInterval(timelinePollRef.current)
  }, [sheetId, showDate])

  // Pre-fetch all show date timelines so Run History displays correctly
  useEffect(() => {
    const dates = Object.keys(curtainTimes).filter(d => d !== showDate)
    Promise.all(dates.map(async date => {
      const { timeline: remote } = await getTimelineRemote(sheetId, date)
      if (remote) saveTimeline(sheetId, date, remote)
    })).then(() => setHistoryVersion(v => v + 1))
  }, [sheetId, timeline.phase])

  const [alertsFired, setAlertsFired] = useState({ 60: false, 30: false, 15: false })
  const alertRefs = useRef({})
  const pollRef = useRef(null)

  useEffect(() => {
    setCurtainTime(curtainTimes[showDate] || '')
    setAlertsFired({ 60: false, 30: false, 15: false })
  }, [showDate, production])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [sheetId, showDate])

  useEffect(() => {
    if (!curtainTime || !showDate) return
    Object.values(alertRefs.current).forEach(t => clearTimeout(t))
    alertRefs.current = {}
    const curtain = todayAt(curtainTime, showDate)
    if (!curtain) return
    [{ minutes: 60 }, { minutes: 30 }, { minutes: 15 }].forEach(({ minutes }) => {
      const alertAt = new Date(curtain.getTime() - minutes * 60000)
      const msUntil = alertAt - new Date()
      if (msUntil <= 0) return
      alertRefs.current[minutes] = setTimeout(async () => {
        setAlertsFired(prev => ({ ...prev, [minutes]: true }))
        try {
          await api.sendCheckinAlerts({ sheetId, showDate, curtainTime, alertMinutes: minutes, autoFired: true })
        } catch (e) { console.warn('Auto alert failed:', e.message) }
      }, msUntil)
    })
    return () => Object.values(alertRefs.current).forEach(t => clearTimeout(t))
  }, [curtainTime, showDate])

  async function load() {
    try {
      const data = await api.getCheckinStatus(sheetId, showDate)
      setStatus(data)
    } catch (e) { console.warn('Failed to load checkins:', e.message) }
    finally { setLoading(false) }
  }

  async function saveCurtainTime(date, time) {
    const updated = { ...curtainTimes, [date]: time }
    try { await api.updateProduction({ sheetId, config: { curtainTimes: JSON.stringify(updated) } }) } catch {}
  }

  async function sendAlerts(alertTarget = 'staff') {
    setAlerting(true); setAlertResult(null)
    try {
      const result = await api.sendCheckinAlerts({ sheetId, showDate, curtainTime, alertMinutes: 60, alertTarget })
      setAlertResult(result)
    } catch (e) { setAlertResult({ error: e.message }) }
    finally { setAlerting(false) }
  }

  const castList = (status?.castList || []).map(c => typeof c === 'string' ? c : c.name).filter(Boolean)
  const checkins = status?.checkins || []
  const checkedInNames = new Set(checkins.map(c => c.castName))
  const manualAbsent = (() => {
    try { return JSON.parse(localStorage.getItem(`rn_checkin_absent_${sheetId}_${showDate}`) || '{}') } catch { return {} }
  })()
  const effectiveCheckins = checkins.filter(c => !manualAbsent[c.castName])
  const missingCast = castList.filter(n => !checkedInNames.has(n) || manualAbsent[n])
  const pct = castList.length ? Math.round((effectiveCheckins.length / castList.length) * 100) : 0
  const checkinUrl = `${window.location.origin}/checkin/${productionCode}/${showDate}`

  const curtain = todayAt(curtainTime, showDate)
  const secsLeft = secsUntil(curtain)
  const curtainPast = secsLeft !== null && secsLeft < 0
  const overCurtainSecs = curtainPast ? Math.abs(secsLeft) : 0

  const intermissionMs = elapsedMs(timeline.intermissionStart)
  const intermissionOver = timeline.phase === 'intermission' && intermissionMs > INTERMISSION_STANDARD

  function RunHistory({ currentDate, version }) {
    const showDates = Object.keys(curtainTimes).sort()
    if (showDates.length < 2) return null

    function msForDate(date) {
      const t = getTimeline(sheetId, date)
      if (t.phase !== 'done') return null
      const a1 = t.act1Start && t.act1End ? new Date(t.act1End) - new Date(t.act1Start) : 0
      const int = t.intermissionStart && t.intermissionEnd ? new Date(t.intermissionEnd) - new Date(t.intermissionStart) : 0
      const a2 = t.act2Start && t.act2End ? new Date(t.act2End) - new Date(t.act2Start) : 0
      return { a1, int, a2, total: a1 + int + a2 }
    }

    function fmtMs2(ms) {
      if (!ms) return '—'
      const totalSec = Math.floor(ms / 1000)
      const h = Math.floor(totalSec / 3600)
      const m = Math.floor((totalSec % 3600) / 60)
      const s = totalSec % 60
      if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      return `${m}:${String(s).padStart(2,'0')}`
    }

    const rows = showDates.map((date) => {
      const times = msForDate(date)
      const isCurrent = date === currentDate
      const label = new Date(date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      return { date, times, isCurrent, label }
    })

    if (!rows.some(r => r.times || r.isCurrent)) return null

    return (
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Run history</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '4px 10px', alignItems: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Show</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>Act 1</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>Int.</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>Act 2</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>Total</div>
          {rows.map(row => (
            <React.Fragment key={row.date}>
              <div style={{ fontSize: 11, color: row.isCurrent ? '#a78bfa' : row.times ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)', fontWeight: row.isCurrent ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                {row.isCurrent && <span style={{ fontSize: 8, background: '#a78bfa', color: '#0f2340', borderRadius: 3, padding: '1px 4px', fontWeight: 800 }}>NOW</span>}
                {row.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: row.isCurrent ? 700 : 400, color: row.times ? (row.isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs2(row.times.a1) : '—'}</div>
              <div style={{ fontSize: 12, fontWeight: row.isCurrent ? 700 : 400, color: row.times ? (row.times.int > 15*60*1000 ? '#fca5a5' : (row.isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.7)')) : 'rgba(255,255,255,0.2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs2(row.times.int) : '—'}</div>
              <div style={{ fontSize: 12, fontWeight: row.isCurrent ? 700 : 400, color: row.times ? (row.isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs2(row.times.a2) : '—'}</div>
              <div style={{ fontSize: 12, fontWeight: row.isCurrent ? 800 : 400, color: row.times ? (row.isCurrent ? '#fff' : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.times ? fmtMs2(row.times.total) : '—'}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  }

  function TimelineHeader() {
    const phase = timeline.phase
    const lockBanner = !isController && lockedBy ? (
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8 }}>🔒 Clock controlled by {lockedBy}</p>
    ) : null

    if (phase === 'preshow') {
      const overdue = curtainPast
      return (
        <div style={{ background: overdue ? 'var(--red-text)' : '#0f2340', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: overdue ? '#fff' : 'rgba(255,255,255,0.6)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{overdue ? '⚠ CURTAIN OVERDUE' : 'Time to Curtain'}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{production?.config?.title}{curtainTime && ` · Curtain ${new Date(`1970-01-01T${curtainTime}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</p>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            {!curtainTime ? (
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>Set curtain time below</p>
            ) : overdue ? (
              <div>
                <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>+{fmtCountdown(overCurtainSecs)}</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>over scheduled curtain — start Act 1 when ready</p>
              </div>
            ) : (
              <div style={{ fontSize: 56, fontWeight: 900, color: secsLeft < 600 ? '#fbbf24' : '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtCountdown(secsLeft)}</div>
            )}
          </div>
          {isController ? (
            <button onClick={() => updateTimeline({ phase: 'act1', act1Start: new Date().toISOString() })} disabled={savingTimeline}
              style={{ width: '100%', marginTop: 12, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius)', padding: '12px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              ▶ Start Act 1
            </button>
          ) : (
            <div style={{ marginTop: 12, padding: '10px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)' }}>
              {lockedBy ? `🔒 Controlled by ${lockedBy}` : '👁 Stage Manager controls the clock'}
            </div>
          )}
          {lockBanner}
          <RunHistory currentDate={showDate} version={historyVersion} />
        </div>
      )
    }

    if (phase === 'act1') {
      return (
        <div style={{ background: '#0f2340', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Now Playing</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '2px 0 0', letterSpacing: '-0.5px', lineHeight: 1 }}>Act One</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Started {new Date(timeline.act1Start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', textAlign: 'center', lineHeight: 1, marginBottom: 12 }}>{fmtElapsed(timeline.act1Start)}</div>
          {isController ? (
            <button onClick={() => { const n = new Date().toISOString(); updateTimeline({ phase: 'intermission', act1End: n, intermissionStart: n }) }} disabled={savingTimeline}
              style={{ width: '100%', background: '#fbbf24', border: 'none', borderRadius: 'var(--radius)', padding: '12px', fontSize: 15, fontWeight: 700, color: '#0f0f0f', cursor: 'pointer' }}>
              ⏸ Start Intermission
            </button>
          ) : (
            <div style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)' }}>
              {lockedBy ? `🔒 Controlled by ${lockedBy}` : '👁 Stage Manager controls the clock'}
            </div>
          )}
          {lockBanner}
          <RunHistory currentDate={showDate} version={historyVersion} />
        </div>
      )
    }

    if (phase === 'intermission') {
      return (
        <div style={{ background: intermissionOver ? 'var(--red-text)' : '#1e1b4b', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 14, transition: 'background 0.5s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: intermissionOver ? '#fff' : 'rgba(255,255,255,0.6)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{intermissionOver ? '⏰ INTERMISSION OVER TIME' : 'Intermission'}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Started {new Date(timeline.intermissionStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {intermissionOver ? (
              <div>
                <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>+{fmtElapsed(new Date(timeline.intermissionStart).getTime() + INTERMISSION_STANDARD)}</div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>over 15 minutes</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtElapsed(timeline.intermissionStart)}</div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 3, margin: '8px 0 0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, (intermissionMs / INTERMISSION_STANDARD) * 100)}%`, background: intermissionMs > INTERMISSION_STANDARD * 0.8 ? '#fbbf24' : '#a78bfa', transition: 'width 1s linear' }} />
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>of standard 15:00</p>
              </div>
            )}
          </div>
          {isController ? (
            <button onClick={() => { const n = new Date().toISOString(); updateTimeline({ phase: 'act2', intermissionEnd: n, act2Start: n }) }} disabled={savingTimeline}
              style={{ width: '100%', background: '#059669', border: 'none', borderRadius: 'var(--radius)', padding: '12px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              ▶ Call Act 2 — House Open
            </button>
          ) : (
            <div style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)' }}>
              {lockedBy ? `🔒 Controlled by ${lockedBy}` : '👁 Stage Manager controls the clock'}
            </div>
          )}
          {lockBanner}
          <RunHistory currentDate={showDate} version={historyVersion} />
        </div>
      )
    }

    if (phase === 'act2') {
      return (
        <div style={{ background: '#14532d', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Now Playing</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '2px 0 0', letterSpacing: '-0.5px', lineHeight: 1 }}>Act Two</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Intermission ran {fmtElapsed(timeline.intermissionStart)} · Act 2 called {new Date(timeline.act2Start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', textAlign: 'center', lineHeight: 1, marginBottom: 12 }}>{fmtElapsed(timeline.act2Start)}</div>
          {isController ? (
            <button onClick={() => { const n = new Date().toISOString(); updateTimeline({ phase: 'done', act2End: n, showEnd: n }) }} disabled={savingTimeline}
              style={{ width: '100%', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius)', padding: '12px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              🎉 End Show
            </button>
          ) : (
            <div style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius)' }}>
              {lockedBy ? `🔒 Controlled by ${lockedBy}` : '👁 Stage Manager controls the clock'}
            </div>
          )}
          {lockBanner}
          <RunHistory currentDate={showDate} version={historyVersion} />
        </div>
      )
    }

    // DONE
    const act1Ms = timeline.act1Start && timeline.act1End ? new Date(timeline.act1End) - new Date(timeline.act1Start) : 0
    const intermissionMs2 = timeline.intermissionStart && timeline.intermissionEnd ? new Date(timeline.intermissionEnd) - new Date(timeline.intermissionStart) : 0
    const act2Ms = timeline.act2Start && timeline.act2End ? new Date(timeline.act2End) - new Date(timeline.act2Start) : 0
    const totalShowMs = act1Ms + act2Ms
    const totalRunningMs = act1Ms + intermissionMs2 + act2Ms

    function fmtMs(ms) {
      const totalSec = Math.floor(ms / 1000)
      const h = Math.floor(totalSec / 3600)
      const m = Math.floor((totalSec % 3600) / 60)
      const s = totalSec % 60
      if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      return `${m}:${String(s).padStart(2,'0')}`
    }

    return (
      <div style={{ background: '#0f2340', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 24, margin: 0 }}>🎉</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '4px 0 2px' }}>Show complete!</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{production?.config?.title} · Performance {timeline.perfNum}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Act 1', ms: act1Ms, start: timeline.act1Start, end: timeline.act1End },
            { label: 'Intermission', ms: intermissionMs2, start: timeline.intermissionStart, end: timeline.intermissionEnd, warn: intermissionMs2 > 15*60*1000 },
            { label: 'Act 2', ms: act2Ms, start: timeline.act2Start, end: timeline.act2End },
          ].map(({ label, ms, start, end, warn }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: warn ? '#fca5a5' : '#fff', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{start ? fmtMs(ms) : '—'}</p>
              {start && <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '3px 0 0' }}>{new Date(start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} → {end ? new Date(end).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) : '?'}</p>}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.12)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Show time</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#a78bfa', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(totalShowMs)}</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>Act 1 + Act 2 only</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total running</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(totalRunningMs)}</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>including intermission</p>
          </div>
        </div>
        {isController && (
          <button onClick={resetTimeline}
            style={{ width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
            Reset for next performance
          </button>
        )}
        <RunHistory currentDate={showDate} version={historyVersion} />
      </div>
    )
  }

  return (
    <div>
      {/* Manual entry modal — inlined to prevent focus loss on re-render */}
      {manualEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Enter show times manually</h2>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' }}>Enter times in any format: 7:32 PM, 19:32, 8:05 PM</p>
            {[
              { key: 'act1Start', label: 'Act 1 Start' },
              { key: 'act1End', label: 'Act 1 End / Intermission Start' },
              { key: 'intermissionStart', label: 'Intermission Start (if different)' },
              { key: 'intermissionEnd', label: 'Intermission End / Act 2 Start' },
              { key: 'act2Start', label: 'Act 2 Start (if different)' },
              { key: 'act2End', label: 'Act 2 End / Show End' },
            ].map(f => (
              <div key={f.key} className="field" style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12 }}>{f.label}</label>
                <input type="text" placeholder="e.g. 7:32 PM" value={manualForm[f.key]}
                  onChange={e => setManualForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                  style={{ fontSize: 13 }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={applyManualEntry}>Apply times</button>
              <button className="btn" onClick={() => setManualEntry(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <TimelineHeader />

      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, flex: '0 0 auto' }}>
            <label style={{ fontSize: 11 }}>Show date</label>
            <input type="date" value={showDate} onChange={e => setShowDate(e.target.value)} style={{ fontSize: 13, padding: '5px 8px' }} />
          </div>
          <div className="field" style={{ margin: 0, flex: '0 0 auto' }}>
            <label style={{ fontSize: 11 }}>Curtain time{curtainTimes[showDate] && <span style={{ color: 'var(--green-text)', marginLeft: 4 }}>✓ saved</span>}</label>
            <input type="time" value={curtainTime}
              onChange={e => { setCurtainTime(e.target.value); setAlertsFired({ 60: false, 30: false, 15: false }) }}
              onBlur={e => { if (e.target.value) saveCurtainTime(showDate, e.target.value) }}
              style={{ fontSize: 13, padding: '5px 8px', width: 110 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button className="btn btn-sm" onClick={load} style={{ fontSize: 11 }}>↻</button>
            <button className="btn btn-sm" onClick={() => setManualEntry(true)} style={{ fontSize: 11 }}>✏ Enter times</button>
            {isController && timeline.phase !== 'preshow' && (
              <button className="btn btn-sm" onClick={resetTimeline} style={{ fontSize: 11 }}>Reset timeline</button>
            )}
          </div>
        </div>
        {curtainTime && curtain && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
            📲 Auto alerts:
            {[60, 30, 15].map(m => {
              const fired = alertsFired[m]
              const alertAt = new Date(curtain.getTime() - m * 60000)
              const timeLabel = alertAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              return (
                <span key={m} style={{ marginLeft: 8, color: fired ? 'var(--green-text)' : 'var(--text2)' }}>
                  {fired ? '✓' : '○'} {m}min ({timeLabel})
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{effectiveCheckins.length} / {castList.length} checked in</p>
          <span style={{ fontSize: 14, fontWeight: 600, color: pct === 100 ? 'var(--green-text)' : pct > 75 ? 'var(--amber-text)' : 'var(--red-text)' }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, transition: 'width 0.5s', width: `${pct}%`, background: pct === 100 ? 'var(--green-text)' : pct > 75 ? 'var(--amber-text)' : 'var(--red-text)' }} />
        </div>
        {pct === 100
          ? <p style={{ fontSize: 12, color: 'var(--green-text)', marginTop: 6, fontWeight: 500 }}>✅ Full house — everyone's in!</p>
          : castList.length > 0 && <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{missingCast.length} still needed</p>
        }
      </div>

      <button onClick={onGoToCheckin}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.875rem 1rem', marginBottom: 12, background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Cast Check-in</p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>QR code, live list, manual check-in</p>
          </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--text3)' }}>→</span>
      </button>

      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: 14 }}>
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

      <CustomAlertPanel sheetId={sheetId} production={production} isShowDay={true} />

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          <button className="btn btn-sm" onClick={() => sendAlerts('staff')} disabled={alerting}
            style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 12 }}>
            {alerting ? '…' : '📲 Alert Staff'}
          </button>
          <button className="btn btn-sm" onClick={() => sendAlerts('cast')} disabled={alerting}
            style={{ background: 'var(--amber-bg)', color: 'var(--amber-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 12 }}>
            {alerting ? '…' : `⚠ Alert Cast (${missingCast.length})`}
          </button>
          <button className="btn btn-sm" onClick={() => sendAlerts('all')} disabled={alerting}
            style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 12 }}>
            {alerting ? '…' : '🔔 Alert All'}
          </button>
        </div>
        {alertResult && (
          <div style={{ marginTop: 8, padding: '0.75rem', background: alertResult.error ? 'var(--red-bg)' : 'var(--bg2)', border: `0.5px solid ${alertResult.error ? 'var(--red-text)' : 'var(--border)'}`, borderRadius: 'var(--radius)', fontSize: 13 }}>
            {alertResult.error
              ? <p style={{ color: 'var(--red-text)' }}>⚠ {alertResult.error}</p>
              : <>
                {alertResult.alerted?.length > 0 && <p style={{ color: 'var(--green-text)', marginBottom: 2 }}>✓ Alerted: {alertResult.alerted.join(', ')}</p>}
                {alertResult.failed?.length > 0 && <p style={{ color: 'var(--red-text)' }}>✗ Failed: {alertResult.failed.map(f => f.name).join(', ')}</p>}
                {!alertResult.alerted?.length && !alertResult.failed?.length && <p style={{ color: 'var(--text2)' }}>No notification contacts on file.</p>}
              </>
            }
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>⚠ Missing ({missingCast.length})</p>
          {missingCast.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>Everyone's in! 🎉</p>
            : missingCast.map(n => (
                <div key={n} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius)', background: 'var(--red-bg)', border: '0.5px solid var(--red-text)', fontSize: 13, color: 'var(--red-text)', fontWeight: 500 }}>{n}</div>
              ))
          }
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>✅ Present ({effectiveCheckins.length})</p>
          {effectiveCheckins.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>No check-ins yet</p>
            : effectiveCheckins.map(c => (
                <div key={c.castName} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius)', background: 'var(--bg2)', border: '0.5px solid var(--border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontWeight: 500 }}>{c.castName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{new Date(c.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  {c.note && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.note}</p>}
                </div>
              ))
          }
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 14 }}>Auto-refreshes every 20 seconds</p>
    </div>
  )
}
