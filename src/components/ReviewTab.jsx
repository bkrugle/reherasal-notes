import { useState } from 'react'
import NoteCard from './NoteCard'

function exportText(notes) {
  const open = notes.filter(n => !n.resolved)
  if (!open.length) { alert('No open notes to export.'); return }
  const byScene = {}
  open.forEach(n => { const k = n.scene || 'General'; if (!byScene[k]) byScene[k] = []; byScene[k].push(n) })
  const lines = ['REHEARSAL NOTES — ' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }), '']
  Object.entries(byScene).forEach(([scene, ns]) => {
    lines.push('== ' + scene.toUpperCase() + ' ==')
    ns.forEach(n => {
      const who = n.cast ? ` [${n.cast}]` : ''
      const cue = n.cue ? ` (@ ${n.cue})` : ''
      const pri = n.priority === 'high' ? ' ★' : ''
      lines.push(`• [${n.category}]${who}${cue}${pri} — ${n.text}`)
    })
    lines.push('')
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'rehearsal-notes-' + new Date().toISOString().slice(0, 10) + '.txt'
  a.click()
}

function exportHtml(notes) {
  const open = notes.filter(n => !n.resolved)
  if (!open.length) { alert('No open notes to export.'); return }
  const byScene = {}
  open.forEach(n => { const k = n.scene || 'General'; if (!byScene[k]) byScene[k] = []; byScene[k].push(n) })
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rehearsal Notes</title>
<style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;color:#1a1a1a;padding:0 1rem}
h1{font-size:22px}h2{font-size:15px;margin:1.5rem 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
ul{margin:0;padding-left:1.25rem}li{margin:5px 0;font-size:14px}
.badge{font-size:11px;padding:1px 7px;border-radius:10px;margin-right:5px;font-weight:500}
.b-blocking{background:#faeeda;color:#633806}.b-performance{background:#eeedfe;color:#3c3489}
.b-music{background:#e1f5ee;color:#085041}.b-technical{background:#faece7;color:#712b13}
.b-general{background:#eaf3de;color:#27500a}.high{color:#a32d2d;font-weight:500}
.sub{color:#666;font-size:13px;margin-bottom:2rem}</style></head><body>`
  html += `<h1>Rehearsal Notes</h1><div class="sub">${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>`
  Object.entries(byScene).forEach(([scene, ns]) => {
    html += `<h2>${scene}</h2><ul>`
    ns.forEach(n => {
      const who = n.cast ? ` <strong>${n.cast}</strong>` : ''
      const cue = n.cue ? ` <em>@ ${n.cue}</em>` : ''
      const pri = n.priority === 'high' ? ` <span class="high">★ high priority</span>` : ''
      html += `<li><span class="badge b-${n.category}">${n.category}</span>${who}${cue}${pri} — ${n.text}</li>`
    })
    html += '</ul>'
  })
  html += '</body></html>'
  const blob = new Blob([html], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'rehearsal-notes-' + new Date().toISOString().slice(0, 10) + '.html'
  a.click()
}

export default function ReviewTab({ notes, sheetId, scenes, characters, loading, onRefresh, onNoteUpdated, onNoteDeleted }) {
  const [catFilter, setCatFilter] = useState('all')
  const [sessionFilter, setSessionFilter] = useState('all')

  const sessions = [...new Set(notes.map(n => n.date))].sort().reverse()

  const scoped = sessionFilter === 'all' ? notes : notes.filter(n => n.date === sessionFilter)
  const filtered = scoped.filter(n => {
    if (catFilter === 'open') return !n.resolved
    if (catFilter === 'high') return n.priority === 'high' && !n.resolved
    if (catFilter !== 'all') return n.category === catFilter
    return true
  })

  const open = scoped.filter(n => !n.resolved).length
  const high = scoped.filter(n => n.priority === 'high' && !n.resolved).length
  const resolved = scoped.filter(n => n.resolved).length

  if (loading) return <div className="empty">Loading notes…</div>

  return (
    <div>
      {/* Session filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <span className="filter-label">Session:</span>
        <button className={`filter-pill ${sessionFilter === 'all' ? 'active' : ''}`} onClick={() => setSessionFilter('all')}>All</button>
        {sessions.map(d => {
          const dt = new Date(d + 'T00:00:00')
          return (
            <button key={d} className={`filter-pill ${sessionFilter === d ? 'active' : ''}`} onClick={() => setSessionFilter(d)}>
              {dt.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </button>
          )
        })}
        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={onRefresh}>↻ Refresh</button>
      </div>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat"><div className="stat-n">{scoped.length}</div><div className="stat-l">total</div></div>
        <div className="stat"><div className="stat-n">{open}</div><div className="stat-l">open</div></div>
        <div className="stat"><div className="stat-n">{high}</div><div className="stat-l">high priority</div></div>
        <div className="stat"><div className="stat-n">{resolved}</div><div className="stat-l">resolved</div></div>
      </div>

      {/* Category filter */}
      <div className="filter-bar">
        <span className="filter-label">Filter:</span>
        {['all', 'open', 'blocking', 'performance', 'music', 'technical', 'high'].map(f => (
          <button key={f} className={`filter-pill ${catFilter === f ? 'active' : ''}`} onClick={() => setCatFilter(f)}>
            {f === 'high' ? 'High priority' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Export */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <button className="btn btn-sm" onClick={() => exportText(scoped)}>Export as text</button>
        <button className="btn btn-sm" onClick={() => exportHtml(scoped)}>Export as HTML</button>
      </div>

      {/* Notes */}
      {filtered.length === 0
        ? <div className="empty">No notes match this filter.</div>
        : <div className="notes-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(n => (
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
      }
    </div>
  )
}
