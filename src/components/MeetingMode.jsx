import { useState, useRef } from 'react'
import { api } from '../lib/api'

export default function MeetingMode({ notes, sheetId, onUpdated, onClose }) {
  // Build a local working copy of open notes — completely independent
  const [localNotes, setLocalNotes] = useState(() =>
    [...notes.filter(n => !n.resolved)]
      .sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0))
      .map(n => ({ ...n }))
  )
  const [idx, setIdx] = useState(0)
  const syncQueue = useRef([])

  const total = localNotes.length
  const resolved = localNotes.filter(n => n._resolved).length
  const open = localNotes.filter(n => !n._resolved)
  const current = open[idx] || open[open.length - 1]
  const allDone = open.length === 0

  function resolve() {
    if (!current) return
    // Mark resolved in local state
    setLocalNotes(prev => prev.map(n =>
      n.id === current.id ? { ...n, _resolved: true } : n
    ))
    // Also update parent so Review tab stays in sync
    onUpdated({ ...current, resolved: true })
    // Background sync
    api.updateNote(sheetId, current.id, { resolved: true })
      .catch(e => console.warn('Sync failed:', e.message))
    // Auto-advance: if there's a next open note, stay at same idx (list shrinks)
    // If we're at the end, go back one
    const newOpen = open.filter(n => n.id !== current.id)
    if (idx >= newOpen.length && newOpen.length > 0) {
      setIdx(newOpen.length - 1)
    }
  }

  function next() {
    if (idx < open.length - 1) setIdx(i => i + 1)
  }

  function prev() {
    if (idx > 0) setIdx(i => i - 1)
  }

  const catColors = {
    blocking:    { bg: 'var(--amber-bg)',  text: 'var(--amber-text)' },
    performance: { bg: 'var(--purple-bg)', text: 'var(--purple-text)' },
    music:       { bg: 'var(--teal-bg)',   text: 'var(--teal-text)' },
    technical:   { bg: 'var(--coral-bg)',  text: 'var(--coral-text)' },
    general:     { bg: 'var(--green-bg)',  text: 'var(--green-text)' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg3)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Notes meeting</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {resolved} resolved · {open.length} remaining
          </span>
        </div>
        <button className="btn btn-sm" onClick={onClose}>Exit</button>
      </div>

      {allDone ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 26, fontWeight: 600 }}>All notes resolved!</p>
          <p className="muted">Great rehearsal. 🎭</p>
          <button className="btn btn-primary" onClick={onClose}>Back to app</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          {/* Progress */}
          <div style={{ width: '100%', maxWidth: 600, marginBottom: '2rem' }}>
            <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2, background: 'var(--text)',
                width: `${total > 0 ? (resolved / total) * 100 : 0}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {idx + 1} of {open.length} open
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {total > 0 ? Math.round((resolved / total) * 100) : 0}% resolved
              </span>
            </div>
          </div>

          {/* Note card */}
          {current && (
            <div key={current.id} style={{
              width: '100%', maxWidth: 600,
              background: 'var(--bg)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-xl)', padding: '2rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <span className={`pdot pdot-${current.priority}`} />
                {current.scene && <span className="badge badge-scene">{current.scene}</span>}
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                  background: catColors[current.category]?.bg || 'var(--gray-bg)',
                  color: catColors[current.category]?.text || 'var(--gray-text)'
                }}>{current.category}</span>
                {current.cast && <span className="badge badge-char">{current.cast}</span>}
                {current.cue && <span style={{ fontSize: 11, color: 'var(--text3)' }}>@ {current.cue}</span>}
                {current.carriedOver === 'true' && (
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-bg)', color: 'var(--amber-text)' }}>carried over</span>
                )}
              </div>

              <p style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.4, color: 'var(--text)', marginBottom: '0.5rem' }}>
                {current.text}
              </p>
              {current.createdBy && (
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>by {current.createdBy}</p>
              )}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem', width: '100%', maxWidth: 600 }}>
            <button className="btn" onClick={prev} disabled={idx === 0} style={{ flex: 1 }}>← Prev</button>
            <button className="btn" onClick={resolve} style={{
              flex: 2, background: 'var(--green-bg)', color: 'var(--green-text)',
              borderColor: 'transparent', fontWeight: 500
            }}>✓ Resolved</button>
            <button className="btn" onClick={next} disabled={idx >= open.length - 1} style={{ flex: 1 }}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}
