import { useState, useEffect } from 'react'

const STORAGE_KEY = 'rn_mics'
const VENUE_KEY = 'rn_mic_venue'
const MIC_COLORS = ['#e24b4a','#ef9f27','#3b82f6','#059669','#7C3AED','#DB2777','#374151','#0369A1','#D97706','#dc2626','#16a34a','#9333ea']
const getMicColor = (num) => MIC_COLORS[(num - 1) % MIC_COLORS.length]

const STATUS_STYLE = {
  unplaced: { bg: 'var(--bg2)',      border: 'var(--border)',      color: 'var(--text3)',      label: 'Unplaced' },
  placed:   { bg: 'var(--amber-bg)', border: 'var(--amber-text)',  color: 'var(--amber-text)', label: 'Placed'   },
  checked:  { bg: 'var(--blue-bg)',  border: 'var(--blue-text)',   color: 'var(--blue-text)',  label: 'Checked'  },
  cleared:  { bg: 'var(--green-bg)', border: 'var(--green-text)',  color: 'var(--green-text)', label: 'Cleared'  },
}

function makeBlankMic(num) {
  return {
    num, nickname: '', assignedTo: '', customName: '',
    status: 'unplaced', note: '',
    // NEW fields
    frequency: '',       // e.g. "518.000 MHz" or "Ch 3"
    batteryChanged: '',  // datetime string
    batteryLife: '8',    // expected hours
    mixNotes: '',        // A1 tech notes — separate from show-night flag
    flagged: false, flagNote: '',
    placedAt: null, checkedAt: null,
  }
}

function defaultVenueData() {
  return {
    lastScan: '',        // datetime of last frequency scan
    scanNotes: '',       // notes from scan (interference sources, avoided ranges)
    venue: '',           // venue name
  }
}

// Battery status helper
function batteryStatus(mic) {
  if (!mic.batteryChanged) return null
  const changed = new Date(mic.batteryChanged)
  const lifeHours = parseFloat(mic.batteryLife) || 8
  const elapsedMs = Date.now() - changed.getTime()
  const elapsedHours = elapsedMs / 3600000
  const remainingHours = lifeHours - elapsedHours
  const pct = Math.max(0, Math.min(100, (remainingHours / lifeHours) * 100))
  return { remainingHours, pct, elapsedHours }
}

function BatteryBar({ pct }) {
  const color = pct > 50 ? 'var(--green-text)' : pct > 20 ? 'var(--amber-text)' : 'var(--red-text)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 600, minWidth: 28 }}>{Math.round(pct)}%</span>
    </div>
  )
}

export default function MicTrackerTab({ characters, production, sheetId }) {
  const storageKey = STORAGE_KEY + '_' + sheetId
  const venueKey = VENUE_KEY + '_' + sheetId
  const castNames = (characters || production?.config?.characters || [])
    .map(c => typeof c === 'string' ? c : (c?.name || '')).filter(Boolean)
  const micCount = parseInt(production?.config?.micCount || '12')

  const [mics, setMics] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      if (saved) return saved.map(m => ({ ...makeBlankMic(m.num), ...m }))
    } catch {}
    return Array.from({ length: micCount }, (_, i) => makeBlankMic(i + 1))
  })

  const [venue, setVenue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(venueKey) || 'null') || defaultVenueData() }
    catch { return defaultVenueData() }
  })

  const [selectedMic, setSelectedMic] = useState(null)
  const [micCountInput, setMicCountInput] = useState(String(mics.length))
  const [view, setView] = useState('all')       // all | flagged | battery
  const [activeTab, setActiveTab] = useState('show') // show | sound
  const [now, setNow] = useState(new Date())

  // Tick for battery countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  function saveMics(updated) {
    setMics(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  function saveVenue(updated) {
    setVenue(updated)
    localStorage.setItem(venueKey, JSON.stringify(updated))
  }

  function updateMic(num, changes) {
    saveMics(mics.map(m => m.num === num ? { ...m, ...changes } : m))
  }

  function updateVenue(changes) {
    saveVenue({ ...venue, ...changes })
  }

  function cycleStatus(num) {
    const mic = mics.find(m => m.num === num)
    if (!mic) return
    const cycle = { unplaced: 'placed', placed: 'checked', checked: 'cleared', cleared: 'unplaced' }
    const next = cycle[mic.status]
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    updateMic(num, {
      status: next,
      placedAt: next === 'placed' ? t : mic.placedAt,
      checkedAt: next === 'checked' ? t : mic.checkedAt,
    })
  }

  function resetNight() {
    if (!confirm('Reset all mic statuses for tonight? Assignments, frequencies, and notes are kept.')) return
    saveMics(mics.map(m => ({ ...m, status: 'unplaced', placedAt: null, checkedAt: null })))
  }

  function clearFlags() {
    if (!confirm('Clear all flags?')) return
    saveMics(mics.map(m => ({ ...m, flagged: false, flagNote: '' })))
  }

  function logBatteryChange(num) {
    updateMic(num, { batteryChanged: new Date().toISOString() })
  }

  function logFreqScanNow() {
    updateVenue({ lastScan: new Date().toISOString() })
  }

  function resizeMics(count) {
    const n = Math.max(1, Math.min(40, parseInt(count) || 12))
    if (n === mics.length) return
    if (n > mics.length) {
      saveMics([...mics, ...Array.from({ length: n - mics.length }, (_, i) => makeBlankMic(mics.length + i + 1))])
    } else {
      saveMics(mics.slice(0, n))
    }
  }

  function micDisplayName(mic) {
    if (mic.nickname) return mic.nickname
    return mic.assignedTo || mic.customName || 'Unassigned'
  }

  const placed    = mics.filter(m => m.status !== 'unplaced')
  const checked   = mics.filter(m => m.status === 'checked' || m.status === 'cleared')
  const cleared   = mics.filter(m => m.status === 'cleared')
  const flagged   = mics.filter(m => m.flagged)
  const notPlaced = mics.filter(m => (m.assignedTo || m.customName) && m.status === 'unplaced')
  const lowBattery = mics.filter(m => { const b = batteryStatus(m); return b && b.pct < 25 })

  const unassignedCast = castNames.filter(n => !mics.some(m => m.assignedTo === n))
  const sel = selectedMic !== null ? mics.find(m => m.num === selectedMic) : null
  const displayMics = view === 'flagged' ? mics.filter(m => m.flagged)
    : view === 'battery' ? mics.filter(m => m.batteryChanged)
    : mics

  // Scan age display
  function scanAge() {
    if (!venue.lastScan) return null
    const ms = Date.now() - new Date(venue.lastScan).getTime()
    const h = Math.floor(ms / 3600000)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ${h % 24}h ago`
    if (h > 0) return `${h}h ago`
    return 'Just now'
  }

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
        {[['show', '🎭 Show night'], ['sound', '🔊 Sound setup']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontWeight: activeTab === id ? 700 : 400,
              background: activeTab === id ? 'var(--accent, #6d28d9)' : 'var(--bg2)',
              color: activeTab === id ? 'white' : 'var(--text2)',
              border: `0.5px solid ${activeTab === id ? 'transparent' : 'var(--border)'}` }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SOUND SETUP TAB ──────────────────────────────────────────────── */}
      {activeTab === 'sound' && (
        <div>
          {/* Venue frequency scan */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700 }}>📡 Frequency Scan</p>
              {venue.lastScan && (
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: Date.now() - new Date(venue.lastScan) > 24*3600000 ? 'var(--amber-bg)' : 'var(--green-bg)',
                  color: Date.now() - new Date(venue.lastScan) > 24*3600000 ? 'var(--amber-text)' : 'var(--green-text)',
                  border: `0.5px solid ${Date.now() - new Date(venue.lastScan) > 24*3600000 ? 'var(--amber-text)' : 'var(--green-text)'}`,
                  fontWeight: 600 }}>
                  Last scan: {scanAge()}
                </span>
              )}
            </div>

            <div className="field" style={{ marginBottom: 8 }}>
              <label>Venue</label>
              <input type="text" value={venue.venue} onChange={e => updateVenue({ venue: e.target.value })}
                placeholder="e.g. Ellis Performing Arts Center, VHS Auditorium" />
            </div>

            <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Last scan date/time</label>
                <input type="datetime-local" value={venue.lastScan ? new Date(venue.lastScan).toISOString().slice(0,16) : ''}
                  onChange={e => updateVenue({ lastScan: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                <button className="btn btn-sm btn-primary" onClick={logFreqScanNow} style={{ fontSize: 12 }}>
                  Log scan now
                </button>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Scan notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(interference sources, avoided ranges, clear channels)</span></label>
              <textarea value={venue.scanNotes} onChange={e => updateVenue({ scanNotes: e.target.value })}
                placeholder="e.g. 518-524 MHz clear. Avoid 530+ — TV station interference. Ch 3 backup confirmed clean."
                style={{ width: '100%', fontSize: 13, minHeight: 72, resize: 'vertical' }} />
            </div>
          </div>

          {/* Per-mic sound setup */}
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Per-mic setup</p>
          {mics.map(mic => {
            const batt = batteryStatus(mic)
            return (
              <div key={mic.num} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: getMicColor(mic.num), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {mic.num}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{micDisplayName(mic)}</p>
                    {mic.frequency && <p style={{ fontSize: 11, color: 'var(--blue-text)', margin: 0, fontFamily: 'monospace' }}>{mic.frequency}</p>}
                  </div>
                  {batt && (
                    <div style={{ width: 100 }}>
                      <BatteryBar pct={batt.pct} />
                      <p style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2, textAlign: 'right' }}>
                        {batt.remainingHours > 0 ? `~${batt.remainingHours.toFixed(1)}h left` : 'Replace now'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid2" style={{ gap: 8, marginBottom: 8 }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Frequency / Channel</label>
                    <input type="text" value={mic.frequency}
                      onChange={e => updateMic(mic.num, { frequency: e.target.value })}
                      placeholder="e.g. 518.000 MHz, Ch 3"
                      style={{ fontFamily: 'monospace', fontSize: 13 }} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Expected battery life (hrs)</label>
                    <input type="number" min="1" max="100" value={mic.batteryLife}
                      onChange={e => updateMic(mic.num, { batteryLife: e.target.value })}
                      style={{ fontSize: 13 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className="field" style={{ margin: 0, flex: 1 }}>
                    <label>Battery last changed</label>
                    <input type="datetime-local"
                      value={mic.batteryChanged ? new Date(mic.batteryChanged).toISOString().slice(0,16) : ''}
                      onChange={e => updateMic(mic.num, { batteryChanged: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
                  </div>
                  <div style={{ paddingTop: 18 }}>
                    <button className="btn btn-sm" onClick={() => logBatteryChange(mic.num)} style={{ fontSize: 11 }}>
                      Changed now
                    </button>
                  </div>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Mix notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(levels, EQ, feedback areas, pack issues)</span></label>
                  <input type="text" value={mic.mixNotes}
                    onChange={e => updateMic(mic.num, { mixNotes: e.target.value })}
                    placeholder="e.g. +3dB at 2kHz, slight feedback at 800Hz near DSR, pack clips on belt" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── SHOW NIGHT TAB ──────────────────────────────────────────────── */}
      {activeTab === 'show' && (
        <div>
          {/* Stats bar */}
          <div className="stats-bar" style={{ marginBottom: '1rem' }}>
            <div className="stat"><div className="stat-n">{placed.length}</div><div className="stat-l">Placed</div></div>
            <div className="stat"><div className="stat-n" style={{ color: 'var(--blue-text)' }}>{checked.length}</div><div className="stat-l">Checked</div></div>
            <div className="stat"><div className="stat-n" style={{ color: 'var(--green-text)' }}>{cleared.length}</div><div className="stat-l">Cleared</div></div>
            <div className="stat"><div className="stat-n" style={{ color: flagged.length > 0 ? 'var(--red-text)' : 'var(--text3)' }}>{flagged.length}</div><div className="stat-l">Flagged</div></div>
            <div className="stat"><div className="stat-n" style={{ color: lowBattery.length > 0 ? 'var(--amber-text)' : 'var(--text3)' }}>{lowBattery.length}</div><div className="stat-l">Low batt</div></div>
          </div>

          {/* Scan status banner */}
          {venue.lastScan && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 10,
              background: Date.now() - new Date(venue.lastScan) > 24*3600000 ? 'var(--amber-bg)' : 'var(--bg2)',
              border: `0.5px solid ${Date.now() - new Date(venue.lastScan) > 24*3600000 ? 'var(--amber-text)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: Date.now() - new Date(venue.lastScan) > 24*3600000 ? 'var(--amber-text)' : 'var(--text2)' }}>
                📡 Freq scan: {scanAge()}{venue.venue ? ` · ${venue.venue}` : ''}
              </p>
              <button className="btn btn-sm" onClick={() => setActiveTab('sound')} style={{ fontSize: 11 }}>
                Sound setup →
              </button>
            </div>
          )}

          {/* Legend + controls */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            {Object.entries(STATUS_STYLE).map(([k, v]) => (
              <span key={k} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: v.bg, color: v.color, border: `0.5px solid ${v.border}` }}>{v.label}</span>
            ))}
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--red-bg)', color: 'var(--red-text)', border: '0.5px solid var(--red-text)' }}>🚩 Flagged</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className={`btn btn-sm ${view === 'flagged' ? 'btn-primary' : ''}`}
                onClick={() => setView(v => v === 'flagged' ? 'all' : 'flagged')} style={{ fontSize: 11 }}>
                {view === 'flagged' ? `🚩 ${flagged.length}` : '🚩 Flagged'}
              </button>
              <button className={`btn btn-sm ${view === 'battery' ? 'btn-primary' : ''}`}
                onClick={() => setView(v => v === 'battery' ? 'all' : 'battery')} style={{ fontSize: 11 }}>
                🔋 Battery
              </button>
              <label style={{ fontSize: 11, color: 'var(--text2)' }}># mics</label>
              <input type="number" min="1" max="40" value={micCountInput}
                onChange={e => setMicCountInput(e.target.value)}
                onBlur={e => resizeMics(e.target.value)}
                style={{ width: 52, fontSize: 12, padding: '4px 6px' }} />
              <button className="btn btn-sm" onClick={resetNight} style={{ fontSize: 11 }}>Reset night</button>
            </div>
          </div>

          {view === 'flagged' && (
            <div style={{ background: 'var(--red-bg)', border: '0.5px solid var(--red-text)', borderRadius: 'var(--radius)', padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: 'var(--red-text)', fontWeight: 600 }}>🚩 {flagged.length} flagged — needs follow-up</p>
              <button className="btn btn-sm" onClick={clearFlags} style={{ fontSize: 11 }}>Clear all</button>
            </div>
          )}

          {view === 'battery' && (
            <div style={{ background: 'var(--amber-bg)', border: '0.5px solid var(--amber-text)', borderRadius: 'var(--radius)', padding: '8px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--amber-text)', fontWeight: 600 }}>🔋 Showing mics with battery logs — tap a mic to log a change</p>
            </div>
          )}

          {/* Mic grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
            {displayMics.map(mic => {
              const st = STATUS_STYLE[mic.status]
              const isSelected = selectedMic === mic.num
              const displayName = micDisplayName(mic)
              const batt = batteryStatus(mic)
              return (
                <div key={mic.num}
                  style={{ background: isSelected ? st.bg : 'var(--bg)', border: `1.5px solid ${mic.flagged ? 'var(--red-text)' : isSelected ? st.border : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '10px 12px', cursor: 'pointer', transition: 'all 0.12s', position: 'relative' }}
                  onClick={() => setSelectedMic(isSelected ? null : mic.num)}>

                  {mic.flagged && <div style={{ position: 'absolute', top: 7, right: 8, fontSize: 12 }}>🚩</div>}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingRight: mic.flagged ? 20 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: getMicColor(mic.num), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {mic.num}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: displayName !== 'Unassigned' ? 'var(--text)' : 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName}
                        </div>
                        {mic.nickname && (mic.assignedTo || mic.customName) && (
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{mic.assignedTo || mic.customName}</div>
                        )}
                        {mic.frequency && (
                          <div style={{ fontSize: 10, color: 'var(--blue-text)', fontFamily: 'monospace' }}>{mic.frequency}</div>
                        )}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); cycleStatus(mic.num) }}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, cursor: 'pointer', flexShrink: 0 }}>
                      {st.label}
                    </button>
                  </div>

                  {batt && <BatteryBar pct={batt.pct} />}

                  {(mic.placedAt || mic.checkedAt) && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                      {mic.placedAt && `Placed ${mic.placedAt}`}{mic.checkedAt ? ` · Checked ${mic.checkedAt}` : ''}
                    </div>
                  )}
                  {mic.note && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mic.note}</div>
                  )}
                  {mic.flagNote && (
                    <div style={{ fontSize: 11, color: 'var(--red-text)', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🚩 {mic.flagNote}</div>
                  )}
                </div>
              )
            })}
            {displayMics.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: 13 }}>
                {view === 'flagged' ? 'No flagged mics — all clear!' : 'No mics with battery logs yet'}
              </div>
            )}
          </div>

          {/* Edit panel */}
          {sel && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: getMicColor(sel.num), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white' }}>
                  {sel.num}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>Mic {sel.num}</p>
                  {sel.nickname && <p style={{ fontSize: 12, color: 'var(--text3)' }}>"{sel.nickname}"</p>}
                  {sel.frequency && <p style={{ fontSize: 11, color: 'var(--blue-text)', fontFamily: 'monospace' }}>{sel.frequency}</p>}
                </div>
                {batteryStatus(sel) && (
                  <div style={{ marginLeft: 'auto', width: 120 }}>
                    <BatteryBar pct={batteryStatus(sel).pct} />
                    <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      ~{Math.max(0, batteryStatus(sel).remainingHours).toFixed(1)}h remaining
                    </p>
                  </div>
                )}
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label>Nickname</label>
                <input type="text" value={sel.nickname} onChange={e => updateMic(sel.num, { nickname: e.target.value })}
                  placeholder="e.g. Schwarzy, Speller mic, Announce" />
              </div>

              <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Assigned to (cast)</label>
                  <select value={sel.assignedTo} onChange={e => updateMic(sel.num, { assignedTo: e.target.value, customName: '' })}>
                    <option value="">— Select cast member —</option>
                    {castNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Or custom name</label>
                  <input type="text" value={sel.customName}
                    onChange={e => updateMic(sel.num, { customName: e.target.value, assignedTo: '' })}
                    placeholder="Leaf's sister, Backstage, Announce"
                    disabled={!!sel.assignedTo} />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label>Show notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(pack location, quick-change, swap)</span></label>
                <input type="text" value={sel.note} onChange={e => updateMic(sel.num, { note: e.target.value })}
                  placeholder="e.g. Pack SR wing shelf, shared with Rona SC15" />
              </div>

              {/* Battery quick-change */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
                <span style={{ fontSize: 13 }}>🔋</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>Battery</p>
                  {sel.batteryChanged
                    ? <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Changed {new Date(sel.batteryChanged).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    : <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Not logged</p>
                  }
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => logBatteryChange(sel.num)} style={{ fontSize: 11 }}>
                  Changed now
                </button>
              </div>

              {/* Flag */}
              <div style={{ background: sel.flagged ? 'var(--red-bg)' : 'var(--bg2)', border: `0.5px solid ${sel.flagged ? 'var(--red-text)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sel.flagged ? 8 : 0 }}>
                  <input type="checkbox" id={`flag-${sel.num}`} checked={sel.flagged}
                    onChange={e => updateMic(sel.num, { flagged: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor={`flag-${sel.num}`} style={{ fontSize: 13, fontWeight: 600, color: sel.flagged ? 'var(--red-text)' : 'var(--text2)', cursor: 'pointer', margin: 0 }}>
                    🚩 Flag for follow-up
                  </label>
                </div>
                {sel.flagged && (
                  <input type="text" value={sel.flagNote}
                    onChange={e => updateMic(sel.num, { flagNote: e.target.value })}
                    placeholder="e.g. Noise when wearing hat — check element; removes hat mid-song 12"
                    style={{ width: '100%', fontSize: 13, marginTop: 4 }} />
                )}
              </div>

              {/* Status buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['unplaced','placed','checked','cleared'].map(s => {
                  const st = STATUS_STYLE[s]
                  return (
                    <button key={s}
                      onClick={() => updateMic(sel.num, {
                        status: s,
                        placedAt: s === 'placed' ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : sel.placedAt,
                        checkedAt: s === 'checked' ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : sel.checkedAt,
                      })}
                      style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, background: sel.status === s ? st.bg : 'transparent', color: st.color, border: `0.5px solid ${st.border}`, cursor: 'pointer', fontWeight: sel.status === s ? 700 : 400 }}>
                      {st.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Unassigned cast warning */}
          {unassignedCast.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--amber-bg)', borderRadius: 'var(--radius)', border: '0.5px solid var(--amber-text)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber-text)', marginBottom: 4 }}>⚠ Cast without mics ({unassignedCast.length})</p>
              <p style={{ fontSize: 12, color: 'var(--amber-text)' }}>{unassignedCast.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
