import { useState, useEffect } from 'react'
import CastManager from '../components/CastManager'
import AuditionMaterials from '../components/AuditionMaterials'
import { castNameList, normalizeCast } from '../lib/castUtils'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

function TagInput({ label, values, onChange, placeholder }) {
  const [input, setInput] = useState('')

  function add() {
    // Support comma-separated input
    const items = input.split(',').map(v => v.trim()).filter(Boolean)
    if (!items.length) return
    const unique = items.filter(v => !values.includes(v))
    if (unique.length) onChange([...values, ...unique])
    setInput('')
  }

  function remove(v) { onChange(values.filter(x => x !== v)) }

  return (
    <div className="field" style={{ marginBottom: '1rem' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder} />
        <button type="button" className="btn btn-sm" onClick={add}>Add</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Separate multiple entries with commas</p>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {values.map(v => (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '3px 10px',
              background: 'var(--bg2)', border: '0.5px solid var(--border)',
              borderRadius: 20
            }}>
              {v}
              <button type="button" onClick={() => remove(v)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SetupPage() {
  const { session, logout } = useSession()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('details')

  const [config, setConfig] = useState({
    title: '', directorName: '', directorEmail: '',
    showDates: '', venue: '', calendarId: '', useAuditions: 'false', auditionQuestions: [], scenes: [], characters: [], staff: []
  })
  const [sharedWith, setSharedWith] = useState([])
  const [newMember, setNewMember] = useState({ name: '', email: '', pin: '', role: 'member' })

  useEffect(() => {
    if (session?.role !== 'admin') { navigate('/production'); return }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await api.getProduction(session.sheetId)
      setConfig({
        title: data.config.title || '',
        directorName: data.config.directorName || '',
        directorEmail: data.config.directorEmail || '',
        showDates: data.config.showDates || '',
        venue: data.config.venue || '',
        calendarId: data.config.calendarId || '',
        useAuditions: data.config.useAuditions || 'false',
        auditionQuestions: Array.isArray(data.config.auditionQuestions) ? data.config.auditionQuestions : [],
        scenes: Array.isArray(data.config.scenes) ? data.config.scenes : [],
        characters: normalizeCast(Array.isArray(data.config.characters) ? data.config.characters : []),
        staff: Array.isArray(data.config.staff) ? data.config.staff : []
      })
      setSharedWith((data.sharedWith || []).map(m => ({ ...m, role: m.role || 'member' })))
    } catch (e) {
      setError('Failed to load production settings')
    } finally {
      setLoading(false)
    }
  }

  function setC(key, val) { setConfig(c => ({ ...c, [key]: val })) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api.updateProduction({ sheetId: session.sheetId, config })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveTeam() {
    setSaving(true)
    setError('')
    try {
      const result = await api.updateProduction({ sheetId: session.sheetId, sharedWith })
      // Send welcome emails to newly added members
      if (result.newInviteCodes) {
        const appUrl = window.location.origin
        for (const member of sharedWith) {
          const inviteCode = result.newInviteCodes[member.name || member.email]
          if (inviteCode && member.email) {
            api.sendWelcome({
              to: member.email,
              memberName: member.name,
              productionTitle: config.title,
              productionCode: session.productionCode,
              inviteCode,
              appUrl,
              directorName: session.name || config.directorName,
              directorEmail: session.email || config.directorEmail
            }).catch(e => console.warn('Welcome email failed:', e.message))
          }
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError('Failed to save team: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduction() {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${config.title}"?\n\nThis will delete the production sheet, all uploaded files, and remove it from the registry. This cannot be undone.`
    )
    if (!confirmed) return
    const doubleConfirm = window.confirm('Last chance — this is permanent. Delete this production?')
    if (!doubleConfirm) return
    setDeleting(true)
    try {
      await api.deleteProduction(session.sheetId, session.productionCode)
      logout()
      navigate('/')
    } catch (e) {
      setError('Failed to delete: ' + e.message)
      setDeleting(false)
    }
  }

  function addMember() {
    if (!newMember.name.trim()) return
    setSharedWith(sw => [...sw, { ...newMember }])
    setNewMember({ name: '', email: '', pin: '' })
  }

  function removeMember(i) {
    setSharedWith(sw => sw.filter((_, idx) => idx !== i))
  }

  function toggleMemberRole(i) {
    setSharedWith(sw => sw.map((m, idx) => idx === i ? { ...m, role: m.role === 'admin' ? 'member' : 'admin' } : m))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="muted">Loading…</p>
    </div>
  )

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <button className="btn btn-sm" onClick={() => navigate('/production')}>← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Production setup</h1>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>{session.productionCode}</span>
      </div>

      <div className="tabs">
        {['details', 'scenes', 'characters', 'team', ...(config.useAuditions && config.useAuditions !== 'false' ? ['auditions'] : [])].map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      {activeTab === 'details' && (
        <div className="card">
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Production title</label>
            <input type="text" value={config.title} onChange={e => setC('title', e.target.value)} />
          </div>
          <div className="grid2" style={{ marginBottom: '1rem' }}>
            <div className="field">
              <label>Director name</label>
              <input type="text" value={config.directorName} onChange={e => setC('directorName', e.target.value)} />
            </div>
            <div className="field">
              <label>Director email</label>
              <input type="email" value={config.directorEmail} onChange={e => setC('directorEmail', e.target.value)} />
            </div>
          </div>
          <div className="grid2" style={{ marginBottom: '1rem' }}>
            <div className="field">
              <label>Show dates</label>
              <input type="text" value={config.showDates} onChange={e => setC('showDates', e.target.value)} />
            </div>
            <div className="field">
              <label>Venue</label>
              <input type="text" value={config.venue} onChange={e => setC('venue', e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: '1.25rem' }}>
            <label>Google Calendar ID (optional)</label>
            <input type="text" value={config.calendarId} onChange={e => setC('calendarId', e.target.value)}
              placeholder="c_abc123...@group.calendar.google.com" />
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Share your calendar with altius-qc-functions@altius-project-hub.iam.gserviceaccount.com (Make changes to events), then paste the Calendar ID here.
            </p>
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '0.5px solid var(--border)' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--red-text)', marginBottom: 8 }}>Danger zone</p>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
              Permanently delete this production, all its notes, uploaded files, and documents. This cannot be undone.
            </p>
            <button className="btn btn-danger" onClick={deleteProduction} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete this production'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'scenes' && (
        <div className="card">
          <p className="muted" style={{ marginBottom: '1rem' }}>These appear in the scene dropdown when logging notes.</p>
          <TagInput label="Scenes / acts" values={config.scenes} onChange={v => setC('scenes', v)} placeholder="e.g. Act 1 Scene 2" />
          <button className="btn btn-primary mt2" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save scenes'}
          </button>
        </div>
      )}

      {activeTab === 'characters' && (
        <div className="card">
          <p className="muted" style={{ marginBottom: '1rem' }}>
            These appear in the cast member autocomplete. Click <strong>Edit</strong> on any entry to add email addresses or mark it as a group.
          </p>
          <CastManager
            label="Cast / characters"
            characters={config.characters}
            onChange={v => setC('characters', v)}
            placeholder="e.g. Elphaba, Ensemble A, Dance Corps"
          />
          <TagInput label="Staff members" values={config.staff} onChange={v => setC('staff', v)} placeholder="e.g. Stage Manager" />
          <button className="btn btn-primary mt2" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save cast & staff'}
          </button>
        </div>
      )}

      {activeTab === 'auditions' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Custom audition questions</p>
            <p className="muted" style={{ marginBottom: '1rem', fontSize: 13 }}>
              These appear on the public audition form in addition to the standard fields.
            </p>
            <TagInput
              label="Custom questions"
              values={config.auditionQuestions}
              onChange={v => setC('auditionQuestions', v)}
              placeholder="e.g. What role are you interested in?, Do you play an instrument?"
            />
            <button className="btn btn-primary mt2" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save questions'}
            </button>
          </div>
          <div className="card">
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>AI preparation materials</p>
            <AuditionMaterials showTitle={config.title} />
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Share access with a team member</p>
            <p className="muted" style={{ marginBottom: '1rem', fontSize: 13 }}>
              Give them the production code <strong>{session.productionCode}</strong> plus the PIN you set below.
            </p>
            <div className="grid3" style={{ marginBottom: '0.75rem' }}>
              <div className="field">
                <label>Name *</label>
                <input type="text" value={newMember.name} onChange={e => setNewMember(m => ({ ...m, name: e.target.value }))} placeholder="Erica" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={newMember.email} onChange={e => setNewMember(m => ({ ...m, email: e.target.value }))} placeholder="erica@school.edu" />
              </div>
              <div className="field">
                <label>Their PIN <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional — they'll set their own)</span></label>
                <input type="text" value={newMember.pin} onChange={e => setNewMember(m => ({ ...m, pin: e.target.value }))} placeholder="Leave blank to send invite" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <input type="checkbox" id="new-member-admin" checked={newMember.role === 'admin'}
                onChange={e => setNewMember(m => ({ ...m, role: e.target.checked ? 'admin' : 'member' }))}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="new-member-admin" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', marginBottom: 0 }}>
                Grant admin access (can edit setup and manage team)
              </label>
            </div>
            <div style={{ display: 'none' }}>
            </div>
            <button className="btn" onClick={addMember}>+ Add team member</button>
          </div>

          {sharedWith.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <p className="section-label" style={{ marginBottom: '0.75rem' }}>Current team members</p>
              {sharedWith.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: i < sharedWith.length - 1 ? '0.5px solid var(--border)' : 'none'
                }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</span>
                    {m.email && <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>{m.email}</span>}
                    {m.activated === false && (
                      <span style={{ fontSize: 11, marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-bg)', color: 'var(--amber-text)', fontWeight: 500 }}>
                        invite pending
                      </span>
                    )}
                    {m.activated === true && (
                      <span style={{ fontSize: 11, marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green-text)', fontWeight: 500 }}>
                        active
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className="btn btn-sm" onClick={() => toggleMemberRole(i)}
                        style={m.role === 'admin' ? { background: 'var(--purple-bg)', color: 'var(--purple-text)', borderColor: 'transparent' } : {}}>
                        {m.role === 'admin' ? '★ Admin' : 'Make admin'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => removeMember(i)}>Remove</button>
                    </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-primary" onClick={saveTeam} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save team'}
          </button>
        </div>
      )}
    </div>
  )
}
