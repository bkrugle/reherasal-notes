import { useState, useEffect } from 'react'
import { castNameList } from '../lib/castUtils'
import { api } from '../lib/api'

const STORAGE_KEY = 'rn_attendance'

function parseShowDates(showDates) {
  if (!showDates) return []
  try {
    const yearMatch = showDates.match(/(20\d{2})/)
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
    const sameMonth = showDates.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*(\d+)/)
    if (sameMonth) {
      const month = new Date(`${sameMonth[1]} 1, ${year}`).getMonth()
      const start = parseInt(sameMonth[2]), end = parseInt(sameMonth[3])
      return Array.from({ length: end - start + 1 }, (_, i) => {
        const d = new Date(year, month, start + i)
        return d.toISOString().slice(0, 10)
      })
    }
  } catch {}
  return []
}

export default function AttendanceTab({ characters, notes, sheetId, production, productionCode }) {
  const charNames = castNameList(characters)
  const showDates = parseShowDates(production?.config?.showDates || '')

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_' + sheetId) || '{}') } catch { return {} }
  })
  const [checkinData, setCheckinData] = useState(null)
  const [loadingCheckin, setLoadingCheckin] = useState(false)
  const [saved, setSaved] = useState(false)

  const isShowDate = showDates.includes(selectedDate)
  const rehearsalDates = [...new Set(notes.map(n => n.date))].sort().reverse()

  // Load check-in data when a show date is selected
  useEffect(() => {
    if (!isShowDate) { setCheckinData(null); return }
    setLoadingCheckin(true)
    api.getCheckinStatus(sheetId, selectedDate)
      .then(data => setCheckinData(data))
      .catch(() => setCheckinData(null))
      .finally(() => setLoadingCheckin(false))
  }, [selectedDate, isShowDate, sheetId])

  // Rehearsal attendance (manual localStorage)
  function saveRecord(updated) {
    setRecords(updated)
    localStorage.setItem(STORAGE_KEY + '_' + sheetId, JSON.stringify(updated))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  function toggle(name) {
    const key = selectedDate + '_' + name
    saveRecord({ ...records, [key]: !isPresent(name) })
  }
  function markAll(present) {
    const updated = { ...records }
    charNames.forEach(name => { updated[selectedDate + '_' + name] = present })
    saveRecord(updated)
  }
  function isPresent(name) {
    return records[selectedDate + '_' + name] !== false
  }

  const dtLabel = (date) => {
    const dt = new Date(date + 'T00:00:00')
    return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (!charNames.length) {
    return <div className="empty">Add cast members in Setup → Characters to track attendance.</div>
  }

  // Show date — pull from check-in system
  if (isShowDate) {
    const checkins = checkinData?.checkins || []
    const checkedInNames = new Set(checkins.map(c => c.castName))
    const present = charNames.filter(n => checkedInNames.has(n))
    const absent = charNames.filter(n => !checkedInNames.has(n))
    const pct = charNames.length ? Math.round((present.length / charNames.length) * 100) : 0

    return (
      <div>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 2 }}>
              {showDates.map(d => (
                <button key={d} className={`btn btn-sm ${selectedDate === d ? 'btn-primary' : ''}`}
                  onClick={() => setSelectedDate(d)}>{dtLabel(d)}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1, background: 'var(--green-bg)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-text)' }}>{present.length}</div>
              <div style={{ fontSize: 11, color: 'var(--green-text)' }}>checked in</div>
            </div>
            <div style={{ flex: 1, background: 'var(--red-bg)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red-text)' }}>{absent.length}</div>
              <div style={{ fontSize: 11, color: 'var(--red-text)' }}>not checked in</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{pct}%</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>of cast</div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            Live from show day check-in · {checkins.length} check-ins recorded
          </p>
        </div>

        {loadingCheckin && <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>Loading check-in data…</p>}

        {!loadingCheckin && (
          <div className="grid2" style={{ gap: 12 }}>
            <div className="card">
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                ✅ Checked in ({present.length})
              </p>
              {present.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>No check-ins yet</p>
                : present.map(name => {
                    const entry = checkins.find(c => c.castName === name)
                    return (
                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{name}</span>
                        {entry?.time && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{entry.time}</span>}
                      </div>
                    )
                  })}
            </div>
            <div className="card">
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                ⏳ Not yet checked in ({absent.length})
              </p>
              {absent.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--text3)' }}>Everyone is in!</p>
                : absent.map(name => (
                    <div key={name} style={{ padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13, color: 'var(--text2)' }}>
                      {name}
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Rehearsal date — manual toggle system
  const presentCount = charNames.filter(n => isPresent(n)).length
  const absentCount = charNames.length - presentCount

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Rehearsal date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          {rehearsalDates.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 2 }}>
              {rehearsalDates.slice(0, 5).map(d => (
                <button key={d} className={`btn btn-sm ${selectedDate === d ? 'btn-primary' : ''}`}
                  onClick={() => setSelectedDate(d)}>{dtLabel(d)}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, background: 'var(--green-bg)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-text)' }}>{presentCount}</div>
            <div style={{ fontSize: 11, color: 'var(--green-text)' }}>present</div>
          </div>
          <div style={{ flex: 1, background: 'var(--red-bg)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red-text)' }}>{absentCount}</div>
            <div style={{ fontSize: 11, color: 'var(--red-text)' }}>absent</div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{charNames.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>total cast</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => markAll(true)}>Mark all present</button>
          <button className="btn btn-sm" onClick={() => markAll(false)}>Mark all absent</button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green-text)', alignSelf: 'center' }}>✓ Saved</span>}
        </div>
      </div>

      <div className="card">
        {charNames.map(name => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
            <span style={{ fontSize: 14, color: isPresent(name) ? 'var(--text)' : 'var(--text3)' }}>{name}</span>
            <button onClick={() => toggle(name)}
              style={{
                padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: '0.5px solid',
                background: isPresent(name) ? 'var(--green-bg)' : 'var(--red-bg)',
                color: isPresent(name) ? 'var(--green-text)' : 'var(--red-text)',
                borderColor: isPresent(name) ? 'var(--green-text)' : 'var(--red-text)',
              }}>
              {isPresent(name) ? 'Present' : 'Absent'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
