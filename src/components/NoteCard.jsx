import { useState } from 'react'
import { api } from '../lib/api'

const CATEGORIES = ['general', 'blocking', 'performance', 'music', 'technical']
const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Normal' },
  { value: 'low', label: 'Low' }
]

export default function NoteCard({ note, sheetId, scenes, characters, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...note })
  // Local optimistic state — drive the UI from this, sync parent in background
  const [localNote, setLocalNote] = useState(note)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function saveEdit() {
    const updated = { ...localNote, ...form }
    setLocalNote(updated)
    setEditing(false)
    onUpdated(updated)
    api.updateNote(sheetId, note.id, {
      text: form.text, scene: form.scene, category: form.category,
      priority: form.priority, cast: form.cast, cue: form.cue
    }).catch(e => console.warn('Sync failed:', e.message))
  }

  function toggleResolve() {
    const updated = { ...localNote, resolved: !localNote.resolved }
    setLocalNote(updated)
    onUpdated(updated)
    api.updateNote(sheetId, note.id, { resolved: !localNote.resolved })
      .catch(e => console.warn('Sync failed:', e.message))
  }

  function deleteNote() {
    if (!confirm('Delete this note? This cannot be undone.')) return
    onDeleted(note.id)
    api.updateNote(sheetId, note.id, { deleted: true })
      .catch(e => console.warn('Sync failed:', e.message))
  }

  const dt = new Date(localNote.date + 'T00:00:00')
  const dateLabel = dt.toLocaleDateString([], { month: 'short', day: 'numeric' })

  if (editing) {
    return (
      <div className="card" style={{ border: '0.5px solid var(--border2)' }}>
        <div className="grid3" style={{ marginBottom: 8 }}>
          <div className="field">
            <label>Scene</label>
            <select value={form.scene} onChange={e => set('scene', e.target.value)}>
              <option value="">— none —</option>
              {scenes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid2" style={{ marginBottom: 8 }}>
          <div className="field">
            <label>Cast member</label>
            <input type="text" value={form.cast} onChange={e => set('cast', e.target.value)} list="edit-cast-list" />
            <datalist id="edit-cast-list">
              {characters.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Cue / reference</label>
            <input type="text" value={form.cue} onChange={e => set('cue', e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Note</label>
          <textarea rows={3} value={form.text} onChange={e => set('text', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
          <button className="btn btn-sm" onClick={() => { setEditing(false); setForm({ ...localNote }) }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ opacity: localNote.resolved ? 0.48 : 1, transition: 'opacity 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span className={`pdot pdot-${localNote.priority}`} />
          {localNote.scene && <span className="badge badge-scene">{localNote.scene}</span>}
          <span className={`badge badge-${localNote.category}`}>{localNote.category}</span>
          {localNote.cast && <span className="badge badge-char">{localNote.cast}</span>}
          {localNote.cue && <span style={{ fontSize: 11, color: 'var(--text3)' }}>@ {localNote.cue}</span>}
          {localNote.swTime && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{localNote.swTime}</span>}
          {localNote.carriedOver === 'true' && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-bg)', color: 'var(--amber-text)' }}>carried over</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {dateLabel} · {localNote.time || ''}
        </span>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.55, textDecoration: localNote.resolved ? 'line-through' : 'none' }}>
        {localNote.text}
      </p>

      {localNote.createdBy && (
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>by {localNote.createdBy}</p>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="btn btn-sm" onClick={toggleResolve}
          style={localNote.resolved ? {} : { color: 'var(--green-text)', borderColor: 'var(--green-text)' }}>
          {localNote.resolved ? '↩ Reopen' : '✓ Resolve'}
        </button>
        <button className="btn btn-sm" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={deleteNote}>Delete</button>
      </div>
    </div>
  )
}
