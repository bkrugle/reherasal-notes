import { useState } from 'react'

const STORAGE_KEY = 'rn_mics'
const MIC_COLORS = ['#e24b4a','#ef9f27','#3b82f6','#059669','#7C3AED','#DB2777','#374151','#0369A1','#D97706','#dc2626','#16a34a','#9333ea']
const getMicColor = (num) => MIC_COLORS[(num - 1) % MIC_COLORS.length]

const STATUS_STYLE = {
  unplaced: { bg: 'var(--bg2)',      border: 'var(--border)',      color: 'var(--text3)',      label: 'Unplaced' },
  placed:   { bg: 'var(--amber-bg)', border: 'var(--amber-text)',  color: 'var(--amber-text)', label: 'Placed'   },
  checked:  { bg: 'var(--blue-bg)',  border: 'var(--blue-text)',   color: 'var(--blue-text)',  label: 'Checked'  },
  cleared:  { bg: 'var(--green-bg)', border: 'var(--green-text)',  color: 'var(--green-text)', label: 'Cleared'  },
}

function makeBlankMic(num) {
  return { num, nickname: '', assignedTo: '', customName: '', status: 'unplaced',
           note: '', flagged: false, flagNote: '', placedAt: null, checkedAt: null }
}

export default function MicTrackerTab({ characters, production, sheetId }) {
  const storageKey = STORAGE_KEY + '_' + sheetId
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

  const [selectedMic, setSelectedMic] = useState(null)
  const [micCountInput, setMicCountInput] = useState(String(mics.length))
  const [view, setView] = useState('all') // all | flagged

  function save(updated) {
    setMics(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  function updateMic(num, changes) {
    save(mics.map(m => m.num === num ? { ...m, ...changes } : m))
  }

  function cycleStatus(num) {
    const mic = mics.find(m => m.num === num)
    if (!mic) return
    const cycle = { unplaced: 'placed', placed: 'checked', checked: 'cleared', cleared: 'unplaced' }
    const next = cycle[mic.status]
    const now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    updateMic(num, {
      status: next,
      placedAt: next === 'placed' ? now : mic.placedAt,
      checkedAt: next === 'checked' ? now : mic.checkedAt,
    })
  }

  function resetNight() {
    if (!confirm('Reset all mic statuses for tonight? Assignments and nicknames are kept.')) return
    save(mics.map(m => ({ ...m, status: 'unplaced', placedAt: null, checkedAt: null })))
  }

  function clearFlags() {
    if (!confirm('Clear all flags?')) return
    save(mics.map(m => ({ ...m, flagged: false, flagNote: '' })))
  }

  function resizeMics(count) {
    const n = Math.max(1, Math.min(40, parseInt(count) || 12))
    if (n === mics.length) return
    if (n > mics.length) {
      save([...mics, ...Array.from({ length: n - mics.length }, (_, i) => makeBlankMic(mics.length + i + 1))])
    } else {
      save(mics.slice(0, n))
    }
  }

  // display name for a mic: nickname > assignedTo/customName > "Unassigned"
  function micDisplayName(mic) {
    if (mic.nickname) return mic.nickname
    return mic.assignedTo || mic.customName || 'Unassigned'
  }

  const placed   = mics.filter(m => m.status !== 'unplaced')
  const checked  = mics.filter(m => m.status === 'checked' || m.status === 'cleared')
  const cleared  = mics.filter(m => m.status === 'cleared')
  const flagged  = mics.filter(m => m.flagged)
  const notPlaced = mics.filter(m => (m.assignedTo || m.customName) && m.status === 'unplaced')

  const unassignedCast = castNames.filter(n => !mics.some(m => m.assignedTo === n))
  const sel = selectedMic !== null ? mics.find(m => m.num === selectedMic) : null

  const displayMics = view === 'flagged' ? mics.filter(m => m.flagged) : mics

  return (
    <div>
      {/* Stats bar */}
      <div className="stats-bar" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="stat-n">{placed.length}</div>
          <div className="stat-l">Placed</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ color: 'var(--blue-text)' }}>{checked.length}</div>
          <div className="stat-l">Checked</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ color: 'var(--green-text)' }}>{cleared.length}</div>
          <div className="stat-l">Cleared</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ color: flagged.length > 0 ? 'var(--red-text)' : 'var(--text3)' }}>{flagged.length}</div>
          <div className="stat-l">Flagged</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ color: notPlaced.length > 0 ? 'var(--amber-text)' : 'var(--text3)' }}>{notPlaced.length}</div>
          <div className="stat-l">Not placed</div>
        </div>
      </div>

      {/* Legend + controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        {Object.entries(STATUS_STYLE).map(([k, v]) => (
          <span key={k} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: v.bg, color: v.color, border: `0.5px solid ${v.border}` }}>
            {v.label}
          </span>
        ))}
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--red-bg)', color: 'var(--red-text)', border: '0.5px solid var(--red-text)' }}>
          🚩 Flagged
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className={`btn btn-sm ${view === 'flagged' ? 'btn-primary' : ''}`}
            onClick={() => setView(v => v === 'flagged' ? 'all' : 'flagged')}
            style={{ fontSize: 11 }}>
            {view === 'flagged' ? `🚩 ${flagged.length} flagged` : '🚩 Show flagged'}
          </button>
          <label style={{ fontSize: 11, color: 'var(--text2)' }}># mics</label>
          <input type="number" min="1" max="40" value={micCountInput}
            onChange={e => setMicCountInput(e.target.value)}
            onBlur={e => resizeMics(e.target.value)}
            style={{ width: 52, fontSize: 12, padding: '4px 6px' }} />
          <button className="btn btn-sm" onClick={resetNight} style={{ fontSize: 11 }}>Reset night</button>
        </div>
      </div>

      {/* Flagged view banner */}
      {view === 'flagged' && (
        <div style={{ background: 'var(--red-bg)', border: '0.5px solid var(--red-text)', borderRadius: 'var(--radius)', padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: 'var(--red-text)', fontWeight: 600 }}>
            🚩 Showing {flagged.length} flagged mic{flagged.length !== 1 ? 's' : ''} — needs follow-up
          </p>
          <button className="btn btn-sm" onClick={clearFlags} style={{ fontSize: 11 }}>Clear all flags</button>
        </div>
      )}

      {/* Mic grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
        {displayMics.map(mic => {
          const st = STATUS_STYLE[mic.status]
          const isSelected = selectedMic === mic.num
          const displayName = micDisplayName(mic)
          return (
            <div key={mic.num}
              style={{
                background: isSelected ? st.bg : 'var(--bg)',
                border: `1.5px solid ${mic.flagged ? 'var(--red-text)' : isSelected ? st.border : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', padding: '10px 12px', cursor: 'pointer',
                transition: 'all 0.12s', position: 'relative'
              }}
              onClick={() => setSelectedMic(isSelected ? null : mic.num)}>

              {mic.flagged && (
                <div style={{ position: 'absolute', top: 7, right: 8, fontSize: 12 }}>🚩</div>
              )}

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
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); cycleStatus(mic.num) }}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, cursor: 'pointer', flexShrink: 0 }}>
                  {st.label}
                </button>
              </div>

              {(mic.placedAt || mic.checkedAt) && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  {mic.placedAt && `Placed ${mic.placedAt}`}{mic.checkedAt ? ` · Checked ${mic.checkedAt}` : ''}
                </div>
              )}
              {mic.note && (
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mic.note}
                </div>
              )}
              {mic.flagNote && (
                <div style={{ fontSize: 11, color: 'var(--red-text)', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🚩 {mic.flagNote}
                </div>
              )}
            </div>
          )
        })}
        {displayMics.length === 0 && view === 'flagged' && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: 13 }}>
            No flagged mics — all clear!
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
            </div>
          </div>

          {/* Nickname */}
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Nickname <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(how you label it — "Schwarzy", "Speller mic", etc.)</span></label>
            <input type="text" value={sel.nickname}
              onChange={e => updateMic(sel.num, { nickname: e.target.value })}
              placeholder="e.g. Schwarzy, Speller mic, Announce" />
          </div>

          {/* Assigned to — cast dropdown OR free-text */}
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Assigned to (cast)</label>
              <select value={sel.assignedTo} onChange={e => updateMic(sel.num, { assignedTo: e.target.value, customName: '' })}>
                <option value="">— Select cast member —</option>
                {castNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>— or custom name <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(Leaf's mom, backstage, announce…)</span></label>
              <input type="text" value={sel.customName}
                onChange={e => updateMic(sel.num, { customName: e.target.value, assignedTo: '' })}
                placeholder="e.g. Leaf's sister, Backstage announce"
                disabled={!!sel.assignedTo} />
            </div>
          </div>

          {/* General note */}
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(pack location, frequency, quick-change, swap info)</span></label>
            <input type="text" value={sel.note}
              onChange={e => updateMic(sel.num, { note: e.target.value })}
              placeholder="e.g. Pack SR wing shelf, freq 518.000, shared with Rona SC15" />
          </div>

          {/* Flag for follow-up */}
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
  )
}
