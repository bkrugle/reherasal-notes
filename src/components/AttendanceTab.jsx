import { useState } from 'react'
import { castNameList } from '../lib/castUtils'

const STORAGE_KEY = 'rn_attendance'

export default function AttendanceTab({ characters, notes, sheetId }) {
  const charNames = castNameList(characters)
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_' + sheetId) || '{}') } catch { return {} }
  })
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [saved, setSaved] = useState(false)

  const rehearsalDates = [...new Set(notes.map(n => n.date))].sort().reverse()

  function save(updated) {
    setRecords(updated)
    localStorage.setItem(STORAGE_KEY + '_' + sheetId, JSON.stringify(updated))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function toggle(name, date) {
    const key = date + '_' + name
    save({ ...records, [key]: !records[key] })
  }

  function markAll(date, present) {
    const updated = { ...records }
    charNames.forEach(name => { updated[date + '_' + name] = present })
    save(updated)
  }

  function isPresent(name, date) {
    return records[date + '_' + name] !== false
  }

  function getAttendanceForDate(date) {
    const present = charNames.filter(n => isPresent(n, date)).length
    return { present, total: charNames.length, absent: charNames.length - present }
  }

  const dtLabel = (date) => {
    const dt = new Date(date + 'T00:00:00')
    return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (!charNames.length) {
    return <div className="empty">Add cast members in Setup → Characters to track attendance.</div>
  }

  const todayStats = getAttendanceForDate(selectedDate)

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Rehearsal date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div style={{ fontSize: 12, padding: '5px 12px', background: 'var(--blue-bg)', color: 'var(--blue-text)', borderRadius: 20, fontWeight: 500, marginBottom: 1 }}>
            {todayStats.present}/{todayStats.total} present
          </div>
          {saved && <div style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 500, marginBottom: 1 }}>✓ Saved</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          <button className="btn btn-sm" onClick={() => markAll(selectedDate, true)}>Mark all present</button>
          <button className="btn btn-sm" onClick={() => markAll(selectedDate, false)}>Mark all absent</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {charNames.map(name => {
            const present = isPresent(name, selectedDate)
            return (
              <div key={name} onClick={() => toggle(name, selectedDate)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 'var(--radius)',
                  border: '0.5px solid ' + (present ? 'var(--green-text)' : 'var(--red-text)'),
                  background: present ? 'var(--green-bg)' : 'var(--red-bg)',
                  cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s'
                }}>
                <span style={{ fontSize: 14, color: present ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 500 }}>
                  {present ? '✓' : '✗'}
                </span>
                <span style={{ fontSize: 13, color: present ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 500 }}>
                  {name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {rehearsalDates.length > 0 && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: '1rem' }}>Attendance history</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>Cast member</th>
                  {rehearsalDates.slice(0, 6).map(d => (
                    <th key={d} style={{ padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {dtLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {charNames.map(name => (
                  <tr key={name}>
                    <td style={{ padding: '5px 8px', borderBottom: '0.5px solid var(--border)', color: 'var(--text)' }}>{name}</td>
                    {rehearsalDates.slice(0, 6).map(d => {
                      const p = isPresent(name, d)
                      return (
                        <td key={d} style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '0.5px solid var(--border)' }}>
                          <span style={{ color: p ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 600 }}>
                            {p ? '✓' : '✗'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
