import { useState, useEffect } from 'react'

const STORAGE_KEY = 'rn_checklist'

const DEFAULT_SECTIONS = [
  { id: 'stage', label: 'Stage', items: [
    'Flies clear and tied off', 'Set pieces in place', 'Props table set', 'Spike marks visible',
    'Preset lighting check', 'Orchestra pit / band in place', 'Stage cleared of rehearsal notes',
  ]},
  { id: 'audio', label: 'Audio', items: [
    'All mics placed and checked', 'Frequencies cleared', 'Monitor mix confirmed',
    'Sound cues loaded and checked', 'Comm headsets on and working',
  ]},
  { id: 'lights', label: 'Lights', items: [
    'Focus check complete', 'Preset state set', 'Followspot operators in position', 'All cues loaded',
  ]},
  { id: 'costumes', label: 'Costumes', items: [
    'All costumes hung and pressed', 'Quick-change stations set', 'Dressers assigned',
    'Wigs / accessories in place',
  ]},
  { id: 'cast', label: 'Cast', items: [
    'All cast checked in', 'Warmup complete', 'Call notes distributed',
    'Understudies confirmed if needed',
  ]},
  { id: 'house', label: 'House', items: [
    'House open to audience', 'Program distributed', 'House manager in position',
    'Concessions ready', 'Emergency exits clear',
  ]},
]

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function PreShowChecklist({ sheetId, production, session }) {
  const showDate = new Date().toISOString().slice(0, 10)
  const storageKey = STORAGE_KEY + '_' + sheetId + '_' + showDate

  const [checks, setChecks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
  })
  const [customSections, setCustomSections] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_custom_' + sheetId) || '[]') } catch { return [] }
  })
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionLabel, setNewSectionLabel] = useState('')
  const [newItem, setNewItem] = useState({})
  const [expandedSections, setExpandedSections] = useState(() =>
    Object.fromEntries([...DEFAULT_SECTIONS, ...[]].map(s => [s.id, true]))
  )

  const allSections = [...DEFAULT_SECTIONS, ...customSections]

  function check(sectionId, itemIdx, who) {
    const key = `${sectionId}_${itemIdx}`
    const updated = { ...checks }
    if (updated[key]) {
      delete updated[key]
    } else {
      updated[key] = { by: who, at: Date.now() }
    }
    setChecks(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  function isChecked(sectionId, itemIdx) {
    return !!checks[`${sectionId}_${itemIdx}`]
  }

  function getCheck(sectionId, itemIdx) {
    return checks[`${sectionId}_${itemIdx}`]
  }

  function sectionProgress(section) {
    const done = section.items.filter((_, i) => isChecked(section.id, i)).length
    return { done, total: section.items.length, pct: Math.round(done / section.items.length * 100) }
  }

  function totalProgress() {
    const total = allSections.reduce((a, s) => a + s.items.length, 0)
    const done = allSections.reduce((a, s) => a + s.items.filter((_, i) => isChecked(s.id, i)).length, 0)
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 }
  }

  function addCustomSection() {
    if (!newSectionLabel.trim()) return
    const id = 'custom_' + Date.now()
    const updated = [...customSections, { id, label: newSectionLabel.trim(), items: [], custom: true }]
    setCustomSections(updated)
    localStorage.setItem(STORAGE_KEY + '_custom_' + sheetId, JSON.stringify(updated))
    setNewSectionLabel('')
    setAddingSection(false)
    setExpandedSections(e => ({ ...e, [id]: true }))
  }

  function addItemToSection(sectionId, text) {
    if (!text.trim()) return
    const updated = customSections.map(s => s.id === sectionId ? { ...s, items: [...s.items, text.trim()] } : s)
    setCustomSections(updated)
    localStorage.setItem(STORAGE_KEY + '_custom_' + sheetId, JSON.stringify(updated))
    setNewItem(n => ({ ...n, [sectionId]: '' }))
  }

  function resetAll() {
    if (!confirm(`Reset all checks for today (${showDate})?`)) return
    setChecks({})
    localStorage.setItem(storageKey, '{}')
  }

  const { done, total, pct } = totalProgress()
  const who = session?.name || 'SM'

  return (
    <div>
      {/* Overall progress */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>{done} / {total} complete</p>
            <p style={{ fontSize: 12, color: 'var(--text2)' }}>{showDate} · {pct === 100 ? '✅ Ready to open!' : `${total - done} items remaining`}</p>
          </div>
          <button className="btn btn-sm" onClick={resetAll} style={{ fontSize: 11 }}>Reset</button>
        </div>
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, transition: 'width 0.4s', width: `${pct}%`, background: pct === 100 ? 'var(--green-text)' : pct > 75 ? 'var(--amber-text)' : 'var(--blue-text)' }} />
        </div>
      </div>

      {allSections.map(section => {
        const prog = sectionProgress(section)
        const expanded = expandedSections[section.id] !== false
        return (
          <div key={section.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: expanded ? 12 : 0 }}
              onClick={() => setExpandedSections(e => ({ ...e, [section.id]: !expanded }))}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{section.label}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: prog.done === prog.total ? 'var(--green-bg)' : 'var(--bg2)',
                    color: prog.done === prog.total ? 'var(--green-text)' : 'var(--text3)',
                    border: '0.5px solid var(--border)' }}>
                    {prog.done}/{prog.total}
                  </span>
                </div>
                <div style={{ height: 3, background: 'var(--bg3)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${prog.pct}%`, background: prog.pct === 100 ? 'var(--green-text)' : 'var(--blue-text)', transition: 'width 0.3s' }} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{expanded ? '↑' : '↓'}</span>
            </div>

            {expanded && (
              <div>
                {section.items.map((item, i) => {
                  const checked = isChecked(section.id, i)
                  const chk = getCheck(section.id, i)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < section.items.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                      <button onClick={() => check(section.id, i, who)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${checked ? 'var(--green-text)' : 'var(--border2)'}`, background: checked ? 'var(--green-text)' : 'transparent', color: 'white', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        {checked ? '✓' : ''}
                      </button>
                      <span style={{ flex: 1, fontSize: 13, color: checked ? 'var(--text3)' : 'var(--text)', textDecoration: checked ? 'line-through' : 'none' }}>{item}</span>
                      {chk && <span style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{chk.by} {formatTime(chk.at)}</span>}
                    </div>
                  )
                })}
                {section.custom && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input type="text" value={newItem[section.id] || ''} onChange={e => setNewItem(n => ({ ...n, [section.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addItemToSection(section.id, newItem[section.id] || '')}
                      placeholder="Add item…" style={{ flex: 1, fontSize: 13 }} />
                    <button className="btn btn-sm" onClick={() => addItemToSection(section.id, newItem[section.id] || '')}>Add</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add section */}
      {addingSection ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input type="text" value={newSectionLabel} onChange={e => setNewSectionLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomSection()}
            placeholder="Section name (e.g. Pyro, Fight Calls)" style={{ flex: 1 }} autoFocus />
          <button className="btn btn-sm" onClick={addCustomSection}>Add</button>
          <button className="btn btn-sm" onClick={() => setAddingSection(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setAddingSection(true)}>+ Add section</button>
      )}
    </div>
  )
}
