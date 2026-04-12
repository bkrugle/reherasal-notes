import { useState, useEffect } from 'react'
import { api } from '../lib/api'

function minutesUntil(timeStr, dateStr) {
  if (!timeStr || !dateStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(h, m, 0, 0)
  return Math.round((d - new Date()) / 60000)
}

export default function IntermissionDashboard({ sheetId, productionCode, production, session, notes, onLogNote }) {
  const showDate = new Date().toISOString().slice(0, 10)
  const curtainTimes = (() => {
    try {
      const raw = production?.config?.curtainTimes
      return typeof raw === 'object' ? raw : JSON.parse(raw || '{}')
    } catch { return {} }
  })()

  // Act 2 curtain = intermission end. Default 20min intermission.
  const act1Curtain = curtainTimes[showDate] || ''
  const [act2Time, setAct2Time] = useState(() => {
    if (!act1Curtain) return ''
    const [h, m] = act1Curtain.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m + 90, 0, 0) // default: 90 min after curtain
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })

  const [checkinStatus, setCheckinStatus] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [now, setNow] = useState(new Date())
  const [perfNum, setPerfNum] = useState(() => {
    const key = `rn_perfnum_${sheetId}`
    return parseInt(localStorage.getItem(key) || '1')
  })

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    api.getCheckinStatus(sheetId, showDate)
      .then(setCheckinStatus)
      .catch(() => {})
  }, [sheetId, showDate])

  const minsToAct2 = act2Time ? minutesUntil(act2Time, showDate) : null
  const castList = checkinStatus?.castList || []
  const checkins = checkinStatus?.checkins || []
  const checkedIn = new Set(checkins.map(c => c.castName))
  const lateArrivals = checkins
    .filter(c => c.checkedInAt)
    .sort((a, b) => new Date(a.checkedInAt) - new Date(b.checkedInAt))
    .filter((c, i) => i > 0) // anyone after first checkin

  // Tonight's performance notes
  const perfNotes = notes.filter(n => n.date === showDate)
  const openHigh = perfNotes.filter(n => n.status === 'open' && n.priority === 'high')
  const openNotes = perfNotes.filter(n => n.status === 'open')

  async function quickLog() {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      await api.saveNote({
        sheetId,
        note: {
          text: newNote,
          date: showDate,
          category: 'performance',
          priority: 'med',
          status: 'open',
          createdBy: session?.name || 'Director',
          scene: `Performance ${perfNum}`,
        }
      })
      setNewNote('')
      if (onLogNote) onLogNote()
    } catch (e) {
      alert('Failed to save: ' + e.message)
    } finally {
      setSavingNote(false)
    }
  }

  const countdown = minsToAct2 !== null
    ? minsToAct2 <= 0 ? { text: 'Act 2 starting!', color: 'var(--red-text)' }
    : minsToAct2 <= 5 ? { text: `${minsToAct2} min to Act 2`, color: 'var(--red-text)' }
    : minsToAct2 <= 10 ? { text: `${minsToAct2} min to Act 2`, color: 'var(--amber-text)' }
    : { text: `${minsToAct2} min to Act 2`, color: 'var(--text2)' }
    : null

  return (
    <div>
      {/* Header strip */}
      <div style={{ background: 'var(--navy, #1a365d)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>🎭 Intermission</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            {production?.config?.title} · Performance {perfNum}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums' }}>
            {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </div>
          {countdown && <div style={{ fontSize: 13, fontWeight: 600, color: countdown.color }}>{countdown.text}</div>}
        </div>
      </div>

      {/* Act 2 time setter */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Act 2 curtain</label>
            <input type="time" value={act2Time} onChange={e => setAct2Time(e.target.value)} style={{ fontSize: 13, padding: '5px 8px', width: 110 }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Performance #</label>
            <input type="number" min="1" value={perfNum} onChange={e => {
              const n = parseInt(e.target.value) || 1
              setPerfNum(n)
              localStorage.setItem(`rn_perfnum_${sheetId}`, n)
            }} style={{ width: 60, fontSize: 13, padding: '5px 8px' }} />
          </div>
          {countdown && (
            <div style={{ padding: '8px 16px', borderRadius: 'var(--radius)', background: minsToAct2 <= 5 ? 'var(--red-bg)' : 'var(--amber-bg)', border: `0.5px solid ${minsToAct2 <= 5 ? 'var(--red-text)' : 'var(--amber-text)'}` }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: countdown.color }}>{countdown.text}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: '1rem', gap: 12 }}>
        {/* Checkin status */}
        <div className="card">
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cast status</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, background: 'var(--green-bg)', borderRadius: 'var(--radius)', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green-text)' }}>{checkedIn.size}</div>
              <div style={{ fontSize: 10, color: 'var(--green-text)' }}>checked in</div>
            </div>
            <div style={{ flex: 1, background: castList.length - checkedIn.size > 0 ? 'var(--red-bg)' : 'var(--bg2)', borderRadius: 'var(--radius)', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: castList.length - checkedIn.size > 0 ? 'var(--red-text)' : 'var(--text3)' }}>{castList.length - checkedIn.size}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>missing</div>
            </div>
          </div>
          {castList.filter(n => !checkedIn.has(n)).length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-text)', marginBottom: 4 }}>Not checked in:</p>
              {castList.filter(n => !checkedIn.has(n)).map(n => (
                <div key={n} style={{ fontSize: 12, color: 'var(--red-text)', padding: '3px 0' }}>{n}</div>
              ))}
            </div>
          )}
        </div>

        {/* High priority notes */}
        <div className="card">
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            Tonight's notes
            {openNotes.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--red-bg)', color: 'var(--red-text)' }}>{openNotes.length} open</span>}
          </p>
          {perfNotes.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text3)' }}>No notes logged yet tonight</p>
            : openNotes.slice(0, 5).map((n, i) => (
                <div key={i} style={{ fontSize: 12, padding: '5px 0', borderBottom: '0.5px solid var(--border)', color: n.priority === 'high' ? 'var(--red-text)' : 'var(--text)' }}>
                  {n.priority === 'high' ? '⚡ ' : ''}{n.text?.slice(0, 60)}{n.text?.length > 60 ? '…' : ''}
                </div>
              ))
          }
          {openNotes.length > 5 && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>+{openNotes.length - 5} more</p>}
        </div>
      </div>

      {/* Quick note logger */}
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Quick note — Act 2</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && quickLog()}
            placeholder="e.g. Mic 4 cutting out in SC12, check battery"
            style={{ flex: 1, fontSize: 14 }} />
          <button className="btn btn-primary" onClick={quickLog} disabled={savingNote || !newNote.trim()}>
            {savingNote ? '…' : 'Log'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Tagged as Performance {perfNum} · Act 2</p>
      </div>
    </div>
  )
}
