import { useState, useEffect } from 'react'

const STORAGE_KEY = 'rn_mics'

const MIC_COLORS = ['#e24b4a','#ef9f27','#3b82f6','#059669','#7C3AED','#DB2777','#374151','#0369A1','#D97706','#dc2626','#16a34a','#9333ea']

function getMicColor(num) {
  return MIC_COLORS[(num - 1) % MIC_COLORS.length]
}

export default function MicTrackerTab({ characters, production, sheetId }) {
  const storageKey = STORAGE_KEY + '_' + sheetId
  const castNames = (production?.config?.characters || []).map(c =>
    typeof c === 'string' ? c : c.name
  ).filter(Boolean)

  const micCount = parseInt(production?.config?.micCount || '12')

  const [mics, setMics] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      if (saved) return saved
    } catch {}
    // Initialize mic array
    return Array.from({ length: micCount }, (_, i) => ({
      num: i + 1,
      assignedTo: '',
      status: 'unplaced', // unplaced | placed | checked | cleared
      note: '',
      placedAt: null,
      checkedAt: null,
    }))
  })

  const [selectedMic, setSelectedMic] = useState(null)
  const [showAssignAll, setShowAssignAll] = useState(false)
  const [micCountInput, setMicCountInput] = useState(String(micCount))

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

  function resetAll() {
    if (!confirm('Reset all mic assignments for tonight?')) return
    save(mics.map(m => ({ ...m, status: 'unplaced', placedAt: null, checkedAt: null })))
  }

  function resizeMics(count) {
    const n = Math.max(1, Math.min(40, parseInt(count) || 12))
    if (n === mics.length) return
    if (n > mics.length) {
      save([...mics, ...Array.from({ length: n - mics.length }, (_, i) => ({
        num: mics.length + i + 1, assignedTo: '', status: 'unplaced', note: '', placedAt: null, checkedAt: null
      }))])
    } else {
      save(mics.slice(0, n))
    }
  }

  const placed = mics.filter(m => m.status !== 'unplaced' && m.assignedTo)
  const checked = mics.filter(m => m.status === 'checked' || m.status === 'cleared')
  const cleared = mics.filter(m => m.status === 'cleared')
  const unassigned = castNames.filter(n => !mics.some(m => m.assignedTo === n))

  const STATUS_STYLE = {
    unplaced: { bg: 'var(--bg2)', border: 'var(--border)', color: 'var(--text3)', label: 'Unplaced' },
    placed:   { bg: 'var(--amber-bg)', border: 'var(--amber-text)', color: 'var(--amber-text)', label: 'Placed' },
    checked:  { bg: 'var(--blue-bg)', border: 'var(--blue-text)', color: 'var(--blue-text)', label: 'Checked' },
    cleared:  { bg: 'var(--green-bg)', border: 'var(--green-text)', color: 'var(--green-text)', label: 'Cleared' },
  }

  const sel = selectedMic ? mics.find(m => m.num === selectedMic) : null

  return (
    <div>
      {/* Stats bar */}
      <div className="stats-bar" style={{ marginBottom: '1rem' }}>
        <div className="stat"><div className="stat-n">{placed.length}</div><div className="stat-l">Placed</div></div>
        <div className="stat"><div className="stat-n" style={{ color: 'var(--blue-text)' }}>{checked.length}</div><div className="stat-l">Checked</div></div>
        <div className="stat"><div className="stat-n" style={{ color: 'var(--green-text)' }}>{cleared.length}</div><div className="stat-l">Cleared</div></div>
        <div className="stat"><div className="stat-n" style={{ color: 'var(--red-text)' }}>{mics.filter(m => m.assignedTo && m.status === 'unplaced').length}</div><div className="stat-l">Not placed</div></div>
      </div>

      {/* Legend + controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        {Object.entries(STATUS_STYLE).map(([k, v]) => (
          <span key={k} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: v.bg, color: v.color, border: `0.5px solid ${v.border}` }}>
            {v.label}
          </span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>tap to cycle →</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'var(--text2)' }}># mics</label>
          <input type="number" min="1" max="40" value={micCountInput}
            onChange={e => setMicCountInput(e.target.value)}
            onBlur={e => resizeMics(e.target.value)}
            style={{ width: 52, fontSize: 12, padding: '4px 6px' }} />
          <button className="btn btn-sm" onClick={resetAll} style={{ fontSize: 11 }}>Reset night</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
        {mics.map(mic => {
          const st = STATUS_STYLE[mic.status]
          const isSelected = selectedMic === mic.num
          return (
            <div key={mic.num}
              style={{ background: isSelected ? st.bg : 'var(--bg)', border: `1.5px solid ${isSelected ? st.border : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '10px 12px', cursor: 'pointer', transition: 'all 0.12s' }}
              onClick={() => setSelectedMic(isSelected ? null : mic.num)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: getMicColor(mic.num), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {mic.num}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: mic.assignedTo ? 'var(--text)' : 'var(--text3)' }}>
                    {mic.assignedTo || 'Unassigned'}
                  </span>
                </div>
                <button onClick={e => { e.stopPropagation(); cycleStatus(mic.num) }}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, cursor: 'pointer' }}>
                  {st.label}
                </button>
              </div>
              {mic.placedAt && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Placed {mic.placedAt}{mic.checkedAt ? ` · Checked ${mic.checkedAt}` : ''}</div>}
              {mic.note && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, fontStyle: 'italic' }}>{mic.note}</div>}
            </div>
          )
        })}
      </div>

      {/* Edit panel for selected mic */}
      {sel && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: getMicColor(sel.num), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white' }}>
              {sel.num}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Mic {sel.num}</p>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Assigned to</label>
            <select value={sel.assignedTo} onChange={e => updateMic(sel.num, { assignedTo: e.target.value })}>
              <option value="">— Unassigned —</option>
              {castNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Note <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(pack location, frequency, swap info)</span></label>
            <input type="text" value={sel.note} onChange={e => updateMic(sel.num, { note: e.target.value })} placeholder="e.g. shared with Rona, pack in SR wing" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['unplaced','placed','checked','cleared'].map(s => {
              const st = STATUS_STYLE[s]
              return (
                <button key={s} onClick={() => updateMic(sel.num, { status: s, placedAt: s === 'placed' ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : sel.placedAt, checkedAt: s === 'checked' ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : sel.checkedAt })}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, background: sel.status === s ? st.bg : 'transparent', color: st.color, border: `0.5px solid ${st.border}`, cursor: 'pointer', fontWeight: sel.status === s ? 600 : 400 }}>
                  {st.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Unassigned cast warning */}
      {unassigned.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'var(--amber-bg)', borderRadius: 'var(--radius)', border: '0.5px solid var(--amber-text)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber-text)', marginBottom: 4 }}>⚠ Cast without mics ({unassigned.length})</p>
          <p style={{ fontSize: 12, color: 'var(--amber-text)' }}>{unassigned.join(', ')}</p>
        </div>
      )}
    </div>
  )
}
