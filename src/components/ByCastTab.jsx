import NoteCard from './NoteCard'
import { api } from '../lib/api'

export default function ByCastTab({ notes, sheetId, scenes, characters, loading, onNoteUpdated, onNoteDeleted }) {
  if (loading) return <div className="empty">Loading notes…</div>
  if (!notes.length) return <div className="empty">No notes yet — log some from the first tab.</div>

  function resolveAll(ns) {
    ns.filter(n => !n.resolved).forEach(n => {
      onNoteUpdated({ ...n, resolved: true })
      api.updateNote(sheetId, n.id, { resolved: true }).catch(e => console.warn('Sync failed:', e.message))
    })
  }

  const members = {}
  notes.forEach(n => {
    const key = n.cast || '(no cast member)'
    if (!members[key]) members[key] = []
    members[key].push(n)
  })

  return (
    <div>
      {Object.entries(members)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, ns]) => {
          const open = ns.filter(n => !n.resolved).length
          return (
            <div key={name} style={{ marginBottom: '1.5rem' }}>
              <div className="section-label">
                {name}
                <span style={{ fontWeight: 400, marginLeft: 8 }}>
                  {open} open · {ns.length} total
                {open > 0 && (
                  <button className="btn btn-sm" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px' }}
                    onClick={() => resolveAll(ns)}>Resolve all</button>
                )}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ns.map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    sheetId={sheetId}
                    scenes={scenes}
                    characters={characters}
                    onUpdated={onNoteUpdated}
                    onDeleted={onNoteDeleted}
                  />
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )
}
