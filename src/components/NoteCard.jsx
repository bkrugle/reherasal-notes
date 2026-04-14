import { useState } from 'react'
import { api } from '../lib/api'
import { castNameList } from '../lib/castUtils'
import { parseHashtags } from '../lib/hashtags'

const CATEGORIES = ['general', 'blocking', 'performance', 'music', 'technical', 'costume', 'set']
const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Normal' },
  { value: 'low', label: 'Low' }
]

function syncNote(sheetId, id, changes) {
  api.updateNote(sheetId, id, changes).catch(e => console.warn('Sync failed:', e.message))
}

export default function NoteCard({ note, sheetId, scenes, characters, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...note })
  const [localNote, setLocalNote] = useState(note)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function saveEdit() {
    const charNames = castNameList(characters)
    const parsed = parseHashtags(form.text, charNames, scenes)

    const finalForm = {
      ...form,
      category: parsed.category || form.category,
      priority: parsed.priority || form.priority,
      cast: parsed.cast || form.cast,
      castList: parsed.cast
        ? parsed.cast.split(',').map(s => s.trim()).filter(Boolean)
        : (form.castList || []),
      scene: parsed.scene || form.scene,
    }

    const updated = { ...localNote, ...finalForm }
    setLocalNote(updated)
    setEditing(false)
    onUpdated(updated)
    syncNote(sheetId, note.id, {
      text: finalForm.text,
      scene: finalForm.scene,
      category: finalForm.category,
      priority: finalForm.priority,
      cast: finalForm.cast,
      castList: finalForm.castList,
      cue: finalForm.cue
    })
  }

  function toggleResolve() {
    const updated = { ...localNote, resolved: !localNote.resolved }
    setLocalNote(updated)
    onUpdated(updated)
    syncNote(sheetId, note.id, { resolved: !localNote.resolved })
  }

  function togglePin() {
    const updated = { ...localNote, pinned: !localNote.pinned }
    setLocalNote(updated)
    onUpdated(updated)
    syncNote(sheetId, note.id, { pinned: !localNote.pinned })
  }

  function togglePrivate() {
    const updated = { ...localNote, privateNote: !localNote.privateNote }
    setLocalNote(updated)
    onUpdated(updated)
    syncNote(sheetId, note.id, { privateNote: !localNote.privateNote })
  }

  function deleteNote() {
    if (!confirm('Delete this note? This cannot be undone.')) return
    onDeleted(note.id)
    syncNote(sheetId, note.id, { deleted: true })
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
            <label>Cast member/Department</label>
            <input type="text" value={form.cast} onChange={e => set('cast', e.target.value)} list="edit-cast-list" />
            <datalist id="edit-cast-list">
              {castNameList(characters).map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Cue / reference</label>
            <input type="text" value={form.cue} onChange={e => set('cue', e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Note <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>— use #blocking #high #Leaf or @LeafConeybear</span></label>
          <textarea rows={3} value={form.text} onChange={e => {
            const val = e.target.value
            set('text', val)
            // Parse hashtags and update fields live as user types
            const charNames = castNameList(characters)
            const parsed = parseHashtags(val, charNames, scenes)
            if (parsed.category) set('category', parsed.category)
            if (parsed.priority) set('priority', parsed.priority)
            if (parsed.cast) set('cast', parsed.cast)
            if (parsed.scene) set('scene', parsed.scene)
          }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
          <button className="btn btn-sm" onClick={() => { setEditing(false); setForm({ ...localNote }) }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{
      opacity: localNote.resolved ? 0.48 : 1,
      transition: 'opacity 0.15s',
      borderLeft: localNote.pinned ? '3px solid var(--amber-text)' : localNote.privateNote ? '3px solid var(--purple-text)' : undefined,
      borderRadius: 'var(--radius-lg)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span className={`pdot pdot-${localNote.priority}`} />
          {localNote.pinned && <span style={{ fontSize: 11 }}>📌</span>}
          {localNote.privateNote && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: 'var(--purple-bg)', color: 'var(--purple-text)' }}>private</span>
          )}
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

      {localNote.attachmentUrl && (
        <a href={localNote.attachmentUrl} target="_blank" rel="noreferrer"
          style={{ display: 'inline-block', marginTop: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius)', background: 'var(--blue-bg)', color: 'var(--blue-text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            📷 View attached photo ↗
          </div>
        </a>
      )}

      {localNote.createdBy && (
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>by {localNote.createdBy}</p>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={toggleResolve}
          style={localNote.resolved ? {} : { color: 'var(--green-text)', borderColor: 'var(--green-text)' }}>
          {localNote.resolved ? '↩ Reopen' : '✓ Resolve'}
        </button>
        <button className="btn btn-sm" onClick={togglePin}
          style={localNote.pinned ? { background: 'var(--amber-bg)', color: 'var(--amber-text)', borderColor: 'transparent' } : {}}>
          {localNote.pinned ? '📌 Pinned' : '📌 Pin'}
        </button>
        <button className="btn btn-sm" onClick={togglePrivate}
          style={localNote.privateNote ? { background: 'var(--purple-bg)', color: 'var(--purple-text)', borderColor: 'transparent' } : {}}>
          {localNote.privateNote ? '🔒 Private' : '🔒'}
        </button>
        <button className="btn btn-sm" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={deleteNote}>Delete</button>
      </div>
    </div>
  )
}
