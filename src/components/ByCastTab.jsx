import NoteCard from './NoteCard'

export default function ByCastTab({ notes, sheetId, scenes, characters, loading, onNoteUpdated, onNoteDeleted }) {
  if (loading) return <div className="empty">Loading notes…</div>
  if (!notes.length) return <div className="empty">No notes yet — log some from the first tab.</div>

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
