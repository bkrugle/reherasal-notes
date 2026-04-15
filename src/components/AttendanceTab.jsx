import { useState, useEffect } from 'react'
import { castNameList, expandedCastList, FULL_ACCESS_ROLES } from '../lib/castUtils'
import { api } from '../lib/api'

const STORAGE_KEY = 'rn_attendance'
const PRIVILEGED_ROLES = [...FULL_ACCESS_ROLES, 'Assistant SM', 'Asst. SM']

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

function getOverrideKey(sheetId, date) {
  return 'rn_overrides_' + sheetId + '_' + date
}

export default function AttendanceTab({ characters, notes, sheetId, production, productionCode, session }) {
  const expandedCast = expandedCastList(characters)
  const charNames = expandedCast.map(c => c.castMember || c.name)
  const showDates = (() => {
    try {
      const ct = production?.config?.curtainTimes
      if (!ct) return parseShowDates(production?.config?.showDates || '')
      const parsed = typeof ct === 'string' ? JSON.parse(ct) : ct
      const keys = Object.keys(parsed).filter(Boolean).sort()
      return keys.length > 0 ? keys : parseShowDates(production?.config?.showDates || '')
    } catch { return parseShowDates(production?.config?.showDates || '') }
  })()

  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_' + sheetId) || '{}') } catch { return {} }
  })
  const [checkinData, setCheckinData] = useState(null)
  const [loadingCheckin, setLoadingCheckin] = useState(false)
  const [saved, setSaved] = useState(false)
  const [markingIn, setMarkingIn] = useState({})
  const [manualOverrides, setManualOverrides] = useState(() => {
    try {
      const today = new Date().toLocaleDateString('en-CA')
      return JSON.parse(localStorage.getItem(getOverrideKey(sheetId, today)) || '{}')
    } catch { return {} }
  })

  const isShowDate = showDates.includes(selectedDate)
  const rehearsalDates = [...new Set(notes.map(n => n.date))].sort().reverse()

  const canOverride = PRIVILEGED_ROLES.includes(session?.staffRole) ||
    session?.role === 'admin' || session?.role === 'member'

  // Reload overrides when date changes
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(getOverrideKey(sheetId, selectedDate)) || '{}')
      setManualOverrides(saved)
    } catch {
      setManualOverrides({})
    }
  }, [selectedDate, sheetId])

  // Load check-in data for all dates
  useEffect(() => {
    setLoadingCheckin(true)
    api.getCheckinStatus(sheetId, selectedDate)
      .then(data => setCheckinData(data))
      .catch(() => setCheckinData(null))
      .finally(() => setLoadingCheckin(false))
  }, [selectedDate, isShowDate, sheetId])

  async function markPresent(name) {
    setMarkingIn(m => ({ ...m, [name]: true }))
    try {
      const castEntry = (checkinData?.castList || []).find(c =>
        c.castMember === name || c.name === name
      )
      const castNameForApi = castEntry?.name || name
      await api.showCheckin({
        productionCode,
        showDate: selectedDate,
        castName: castNameForApi,
        note: 'Manually marked present'
      })
      // Remove any absent override for this person
      const key = getOverrideKey(sheetId, selectedDate)
      const overrides = JSON.parse(localStorage.getItem(key) || '{}')
      delete overrides[name]
      localStorage.setItem(key, JSON.stringify(overrides))
      setManualOverrides(overrides)
      const data = await api.getCheckinStatus(sheetId, selectedDate)
      setCheckinData(data)
    } catch (e) {
      console.warn('Manual check-in failed:', e.message)
    } finally {
      setMarkingIn(m => ({ ...m, [name]: false }))
    }
  }

  function markAbsent(name) {
    const key = getOverrideKey(sheetId, selectedDate)
    const overrides = JSON.parse(localStorage.getItem(key) || '{}')
    overrides[name] = 'absent'
    localStorage.setItem(key, JSON.stringify(overrides))
    setManualOverrides({ ...overrides })
  }

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
    return records[selectedDate + '_' + name] === true
  }

  const dtLabel = (date) => {
    const dt = new Date(date + 'T00:00:00')
    return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (!charNames.length) {
    return <div className="empty">Add cast members in Setup → Characters to track attendance.</div>
  }

  if (checkinData !== null || loadingCheckin) {
    const checkins = checkinData?.checkins || []
    const checkedInNames = new Set(checkins.map(c => c.castName))
    const castListFull = (checkinData?.castList || []).map(c => typeof c === 'string' ? { name: c, castMember: '' } : c)
    function isCheckedIn(charName) {
      if (checkedInNames.has(charName)) return true
      const entry = castListFull.find(c => c.castMember === charName)
      return entry ? checkedInNames.has(entry.name) : false
    }
    const present = charNames.filter(n => manualOverrides[n] !== 'absent' && (isCheckedIn(n) || manualOverrides[n] === 'present'))
    const absent = charNames.filter(n => manualOverrides[n] === 'absent' || (manualOverrides[n] !== 'present' && !isCheckedIn(n)))
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
            Live from check-in · {checkins.length} check-ins recorded
            {canOverride && <span style={{ marginLeft: 6, color: 'var(--blue-text)' }}>· tap ✓ to mark present, ✗ to undo</span>}
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
                    const castEntry = castListFull.find(c => c.castMember === name || c.name === name)
                    const checkinEntry = checkins.find(c => c.castName === (castEntry?.name || name))
                    return (
                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{name}</span>
                          {castEntry?.group && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6 }}>{castEntry.group}</span>}
                          {checkinEntry?.note === 'Manually marked present' && (
                            <span style={{ fontSize: 10, color: 'var(--blue-text)', marginLeft: 6 }}>manual</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {checkinEntry?.checkedInAt && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(checkinEntry.checkedInAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>}
                          {canOverride && (checkinEntry?.note === 'Manually marked present' || manualOverrides[name] === 'present') && (
                            <button onClick={() => markAbsent(name)} style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, cursor: 'pointer', border: '0.5px solid var(--red-text)', background: 'var(--red-bg)', color: 'var(--red-text)' }}>✗ Undo</button>
                          )}
                        </div>
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
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13, color: 'var(--text2)' }}>
                      <span>{name}</span>
                      {canOverride && (
                        <button
                          onClick={() => markPresent(name)}
                          disabled={markingIn[name]}
                          style={{
                            padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                            cursor: 'pointer', border: '0.5px solid var(--green-text)',
                            background: 'var(--green-bg)', color: 'var(--green-text)',
                            opacity: markingIn[name] ? 0.5 : 1
                          }}>
                          {markingIn[name] ? '…' : '✓ Present'}
                        </button>
                      )}
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
    )
  }

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
        {(() => {
          const grouped = {}
          expandedCast.forEach(c => {
            const key = c.group || ''
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(c.name)
          })
          return Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0])).map(([grp, names]) => (
            <div key={grp || 'ungrouped'} style={{ marginBottom: grp ? 8 : 0 }}>
              {grp && (
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 0 4px', borderBottom: '0.5px solid var(--border2)' }}>
                  {grp}
                </p>
              )}
              {names.map(name => {
                const entry = expandedCast.find(c => c.name === name)
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 14, color: isPresent(name) ? 'var(--text)' : 'var(--text3)' }}>{name}</div>
                      {entry?.castMember && (
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{entry.castMember}</div>
                      )}
                    </div>
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
                )
              })}
            </div>
          ))
        })()}
      </div>
    </div>
  )
}
