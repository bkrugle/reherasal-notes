import { useState, useEffect } from 'react'
import { api } from '../lib/api'

function AuditionerModal({ auditioner, sheetId, createdBy, onClose, onRoleAssigned }) {
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState(auditioner.notes || [])
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState(auditioner.role || '')
  const [assigningRole, setAssigningRole] = useState(false)

  async function addNote() {
    if (!note.trim()) return
    setSaving(true)
    try {
      const result = await api.saveAuditionNote({ sheetId, auditionerId: auditioner.id, text: note.trim(), createdBy })
      setNotes(prev => [...prev, { id: result.id, text: note.trim(), createdBy, createdAt: result.createdAt }])
      setNote('')
    } catch (e) { alert('Failed: ' + e.message) }
    finally { setSaving(false) }
  }

  async function assignRole() {
    setAssigningRole(true)
    try {
      await api.assignRole({ sheetId, auditionerId: auditioner.id, role })
      onRoleAssigned(auditioner.id, role)
    } catch (e) { alert('Failed: ' + e.message) }
    finally { setAssigningRole(false) }
  }

  const answers = auditioner.customAnswers || {}

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 560, padding: '1.5rem', marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {auditioner.headshotUrl ? (
              <img src={auditioner.headshotUrl} alt={auditioner.firstName} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0, border: '0.5px solid var(--border)' }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 'var(--radius)', background: 'var(--blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600, color: 'var(--blue-text)', flexShrink: 0 }}>
                {auditioner.firstName[0]}{auditioner.lastName[0]}
              </div>
            )}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{auditioner.firstName} {auditioner.lastName}</h2>
              {auditioner.grade && <p style={{ fontSize: 13, color: 'var(--text2)' }}>Grade {auditioner.grade}{auditioner.age ? ` · Age ${auditioner.age}` : ''}</p>}
              {auditioner.email && <p style={{ fontSize: 13, color: 'var(--text3)' }}>{auditioner.email}</p>}
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose}>×</button>
        </div>

        {/* Info */}
        <div style={{ display: 'grid', gap: 8, marginBottom: '1.25rem' }}>
          {auditioner.experience && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 2 }}>EXPERIENCE</p>
              <p style={{ fontSize: 13 }}>{auditioner.experience}</p>
            </div>
          )}
          {auditioner.conflicts && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 2 }}>CONFLICTS</p>
              <p style={{ fontSize: 13 }}>{auditioner.conflicts}</p>
            </div>
          )}
          {Object.entries(answers).map(([q, a]) => (
            <div key={q}>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 2 }}>{q.toUpperCase()}</p>
              <p style={{ fontSize: 13 }}>{a}</p>
            </div>
          ))}
        </div>

        {/* Role assignment */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius)' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Assign role</label>
            <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Elphaba, Ensemble, Understdy…" />
          </div>
          <button className="btn btn-sm" onClick={assignRole} disabled={assigningRole} style={{ alignSelf: 'flex-end' }}>
            {assigningRole ? 'Saving…' : 'Assign'}
          </button>
        </div>

        {/* Staff notes */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Staff notes</p>
          {notes.length > 0 && (
            <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notes.map(n => (
                <div key={n.id} style={{ fontSize: 13, padding: '6px 10px', background: 'var(--bg2)', borderRadius: 'var(--radius)' }}>
                  <p style={{ marginBottom: 2 }}>{n.text}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {n.createdBy && `${n.createdBy} · `}{n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Add a note about this auditioner…" style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={addNote} disabled={saving || !note.trim()} style={{ alignSelf: 'flex-end' }}>
              {saving ? '…' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuditionsTab({ sheetId, productionCode, session, production }) {
  const [auditioners, setAuditioners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  const auditionUrl = `${window.location.origin}/audition/${productionCode}`

  useEffect(() => {
    loadAuditioners()
    const interval = setInterval(loadAuditioners, 30000) // auto-refresh every 30s
    return () => clearInterval(interval)
  }, [])

  async function loadAuditioners() {
    try {
      const data = await api.getAuditioners(sheetId)
      setAuditioners(data.auditioners || [])
    } catch (e) { console.warn('Failed to load auditioners:', e.message) }
    finally { setLoading(false) }
  }

  function onRoleAssigned(id, role) {
    setAuditioners(prev => prev.map(a => a.id === id ? { ...a, role, castConfirmed: !!role } : a))
    setSelected(prev => prev?.id === id ? { ...prev, role, castConfirmed: !!role } : prev)
  }

  const filtered = auditioners.filter(a => {
    const name = `${a.firstName} ${a.lastName}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase())) return false
    if (filterRole === 'cast') return !!a.role
    if (filterRole === 'uncast') return !a.role
    return true
  })

  const castCount = auditioners.filter(a => a.role).length

  return (
    <div>
      {/* Audition link */}
      <div className="card" style={{ marginBottom: '1rem', background: 'var(--blue-bg)', border: '0.5px solid var(--blue-text)' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--blue-text)', marginBottom: 4 }}>Audition form link</p>
        <p style={{ fontSize: 12, color: 'var(--blue-text)', wordBreak: 'break-all', marginBottom: 8 }}>{auditionUrl}</p>
        <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(auditionUrl)}
          style={{ fontSize: 12, background: 'var(--blue-text)', color: 'var(--bg)', borderColor: 'transparent' }}>
          Copy link
        </button>
      </div>

      {/* Stats + filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="stats-bar" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat"><div className="stat-n">{auditioners.length}</div><div className="stat-l">auditioned</div></div>
          <div className="stat"><div className="stat-n">{castCount}</div><div className="stat-l">cast</div></div>
          <div className="stat"><div className="stat-n">{auditioners.length - castCount}</div><div className="stat-l">pending</div></div>
          <div className="stat"><div className="stat-n" style={{ fontSize: 12, color: 'var(--text3)' }}>auto-refresh</div><div className="stat-l">30s</div></div>
        </div>
        <button className="btn btn-sm" onClick={loadAuditioners}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…" style={{ flex: 1, minWidth: 160 }} />
        {['all','cast','uncast'].map(f => (
          <button key={f} className={`filter-pill ${filterRole === f ? 'active' : ''}`} onClick={() => setFilterRole(f)}>
            {f === 'all' ? 'All' : f === 'cast' ? 'Cast' : 'Not yet cast'}
          </button>
        ))}
      </div>

      {loading ? <div className="empty">Loading auditioners…</div>
        : filtered.length === 0 ? <div className="empty">{auditioners.length === 0 ? 'No auditions submitted yet. Share the form link above.' : 'No results.'}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {filtered.map(a => (
              <div key={a.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(a)}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {a.headshotUrl ? (
                    <img src={a.headshotUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--blue-text)', flexShrink: 0 }}>
                      {a.firstName[0]}{a.lastName[0]}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{a.firstName} {a.lastName}</p>
                    {a.grade && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Grade {a.grade}</p>}
                    {a.role && <p style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 500 }}>{a.role}</p>}
                    {a.notes?.length > 0 && <p style={{ fontSize: 11, color: 'var(--text3)' }}>{a.notes.length} note{a.notes.length !== 1 ? 's' : ''}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {selected && (
        <AuditionerModal
          auditioner={selected}
          sheetId={sheetId}
          createdBy={session?.name || session?.role || ''}
          onClose={() => setSelected(null)}
          onRoleAssigned={onRoleAssigned}
        />
      )}
    </div>
  )
}
