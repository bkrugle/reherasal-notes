import { useState, useEffect } from 'react'
import CastManager from '../components/CastManager'

// Parses showDates string into array of ISO date strings
function parseShowDates(showDates) {
  if (!showDates) return []
  try {
    const yearMatch = showDates.match(/(20\d{2})/)
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
    const sameMonth = showDates.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*(\d+)/)
    if (sameMonth) {
      const [, month, d1, d2] = sameMonth
      const dates = []
      for (let d = parseInt(d1); d <= parseInt(d2); d++) {
        const dt = new Date(`${month} ${d}, ${year}`)
        if (!isNaN(dt)) dates.push(dt.toISOString().slice(0, 10))
      }
      return dates
    }
    const crossMonth = showDates.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*([A-Za-z]+)\s+(\d+)/)
    if (crossMonth) {
      const [, m1, d1, m2, d2] = crossMonth
      const start = new Date(`${m1} ${d1}, ${year}`)
      const end = new Date(`${m2} ${d2}, ${year}`)
      const dates = []
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        dates.push(dt.toISOString().slice(0, 10))
      }
      return dates
    }
    const single = new Date(showDates)
    if (!isNaN(single)) return [single.toISOString().slice(0, 10)]
  } catch (e) {}
  return []
}

function CurtainTimesEditor({ curtainTimes, showDates, onChange }) {
  const dates = parseShowDates(showDates)
  if (!dates.length) return (
    <p style={{ fontSize: 12, color: 'var(--text3)' }}>Enter show dates above to set curtain times per day.</p>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dates.map(date => {
        const dt = new Date(date + 'T00:00:00')
        const label = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
        return (
          <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)', minWidth: 100 }}>{label}</span>
            <input type="time" value={curtainTimes[date] || ''}
              onChange={e => onChange({ ...curtainTimes, [date]: e.target.value })}
              style={{ fontSize: 13, padding: '4px 8px', width: 110 }} />
            {curtainTimes[date] && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {new Date(`1970-01-01T${curtainTimes[date]}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LookupResultPanel({ result, existing, onApply, onDismiss }) {
  const existingNames = existing.map(c => typeof c === 'string' ? c : c.name)
  const [selected, setSelected] = useState(() =>
    result.characters.filter(name => !existingNames.includes(name))
  )

  function toggle(name) {
    setSelected(s => s.includes(name) ? s.filter(n => n !== name) : [...s, name])
  }

  return (
    <div style={{ background: 'var(--purple-bg)', border: '0.5px solid var(--purple-text)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--purple-text)' }}>
          ✨ Found {result.characters.length} characters for <em>{result.showTitle}</em>
        </p>
        <button className="btn btn-sm" onClick={onDismiss} style={{ fontSize: 11 }}>Dismiss</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--purple-text)', opacity: 0.8, marginBottom: 10 }}>
        Select the ones you want to add. Already-added characters are greyed out.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {result.characters.map(name => {
          const already = existingNames.includes(name)
          const sel = selected.includes(name)
          return (
            <button key={name} type="button"
              onClick={() => !already && toggle(name)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: already ? 'default' : 'pointer',
                border: '0.5px solid ' + (already ? 'var(--border)' : sel ? 'var(--purple-text)' : 'var(--purple-text)'),
                background: already ? 'var(--bg3)' : sel ? 'var(--purple-text)' : 'transparent',
                color: already ? 'var(--text3)' : sel ? 'var(--bg)' : 'var(--purple-text)',
                opacity: already ? 0.5 : 1
              }}>
              {already ? '✓ ' : sel ? '✓ ' : ''}{name}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" onClick={() => setSelected(result.characters.filter(n => !existingNames.includes(n)))}>
          Select all
        </button>
        <button className="btn btn-sm" onClick={() => setSelected([])}>None</button>
        <button className="btn btn-primary btn-sm" onClick={() => onApply(selected)} disabled={!selected.length}
          style={{ marginLeft: 'auto' }}>
          Add {selected.length} character{selected.length !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  )
}
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

function NotificationContactForm({ onAdd }) {
  const [form, setForm] = useState({ name: '', role: 'Stage Manager', phone: '', smsGateway: '' })
  const carriers = [
    { label: 'Verizon', suffix: '@vtext.com' },
    { label: 'AT&T', suffix: '@txt.att.net' },
    { label: 'T-Mobile', suffix: '@tmomail.net' },
    { label: 'Sprint', suffix: '@messaging.sprintpcs.com' },
  ]

  function buildGateway(phone, suffix) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) return digits + suffix
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1) + suffix
    return ''
  }

  function add() {
    if (!form.name.trim()) return
    if (!form.phone && !form.smsGateway) return
    const contact = { ...form }
    // Auto-build gateway if phone + carrier selected but no gateway entered
    onAdd(contact)
    setForm({ name: '', role: 'Stage Manager', phone: '', smsGateway: '' })
  }

  return (
    <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Add notification contact</p>
      <div className="grid2" style={{ marginBottom: 8 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Name *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Sarah (SM)" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {['Stage Manager', 'Assistant SM', 'Music Director', 'Director', 'Producer', 'Tech Director'].map(r =>
              <option key={r} value={r}>{r}</option>
            )}
          </select>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Phone number</label>
        <input type="tel" value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          onInput={e => setForm(f => ({ ...f, phone: e.target.value }))}
          onBlur={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="4125550100"
          autoComplete="off" />
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>
          SMS Gateway email <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(free — no Twilio needed)</span>
        </label>
        <input type="text" value={form.smsGateway}
          onChange={e => setForm(f => ({ ...f, smsGateway: e.target.value }))}
          placeholder="e.g. 4125550100@vtext.com"
          autoComplete="off" />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {['Verizon', 'AT&T', 'T-Mobile', 'Sprint'].map((label, i) => {
            const suffix = ['@vtext.com','@txt.att.net','@tmomail.net','@messaging.sprintpcs.com'][i]
            const digits = form.phone.replace(/\D/g, '')
            const num = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
            const gw = num.length === 10 ? num + suffix : ''
            return (
              <button key={label} type="button" className="btn btn-sm"
                onClick={() => {
                  // Re-read phone from state at click time
                  const d = form.phone.replace(/\D/g, '')
                  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
                  if (n.length === 10) {
                    setForm(f => ({ ...f, smsGateway: n + suffix }))
                  } else {
                    alert(`Enter your 10-digit phone number first (got ${d.length} digits)`)
                  }
                }}
                style={{ fontSize: 11, opacity: gw ? 1 : 0.5 }}>
                {label} →
              </button>
            )
          })}
        </div>
        {form.smsGateway && (
          <p style={{ fontSize: 11, color: 'var(--green-text)', marginTop: 4 }}>
            ✓ {form.smsGateway}
          </p>
        )}
      </div>
      <button className="btn btn-primary btn-sm" onClick={add} disabled={!form.name || (!form.phone && !form.smsGateway)}>
        + Add contact
      </button>
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
  const [lookingUpCast, setLookingUpCast] = useState(false)
  const [lookupResult, setLookupResult] = useState(null)
  const [lookingUpScenes, setLookingUpScenes] = useState(false)
  const [sceneLookupResult, setSceneLookupResult] = useState(null) // { characters, showTitle }
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('details')

  const [config, setConfig] = useState({
    title: '', directorName: '', directorEmail: '',
    showDates: '', venue: '', calendarId: '', useAuditions: 'false', auditionQuestions: [], scenes: [], characters: [], staff: [], curtainTimes: {}, notificationContacts: []
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
        useAuditions: (data.config.useAuditions === true || data.config.useAuditions === 'true' || String(data.config.useAuditions) === 'true') ? true : false,
        curtainTimes: typeof data.config.curtainTimes === 'object' ? data.config.curtainTimes : {},
        auditionQuestions: Array.isArray(data.config.auditionQuestions) ? data.config.auditionQuestions : [],
        scenes: Array.isArray(data.config.scenes) ? data.config.scenes : [],
        characters: normalizeCast(Array.isArray(data.config.characters) ? data.config.characters : []),
        staff: Array.isArray(data.config.staff) ? data.config.staff : [],
        notificationContacts: Array.isArray(data.config.notificationContacts) ? data.config.notificationContacts : []
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

  async function lookupCast() {
    if (!config.title) { setError('Enter a production title in the Details tab first'); return }
    setLookingUpCast(true)
    setLookupResult(null)
    setError('')
    try {
      const data = await api.lookupShowCast(config.title)
      if (data.characters && data.characters.length > 0) {
        setLookupResult(data)
      } else {
        setError(`No characters found for "${config.title}". You can still add them manually below.`)
      }
    } catch (e) {
      setError('Lookup failed: ' + e.message)
    } finally {
      setLookingUpCast(false)
    }
  }

  async function lookupScenes() {
    if (!config.title) { setError('Enter a production title in the Details tab first'); return }
    setLookingUpScenes(true)
    setSceneLookupResult(null)
    setError('')
    try {
      const data = await api.lookupShowScenes(config.title)
      if (data.scenes?.length > 0) setSceneLookupResult(data)
      else setError('No scenes found — add them manually below.')
    } catch (e) { setError('Lookup failed: ' + e.message) }
    finally { setLookingUpScenes(false) }
  }

  function applyLookupResult(selected) {
    // Merge selected characters with existing, avoiding duplicates
    const existing = config.characters.map(c => typeof c === 'string' ? c : c.name)
    const toAdd = selected.filter(name => !existing.includes(name))
      .map(name => ({ name, emails: [], members: [], isGroup: false }))
    setC('characters', [...config.characters, ...toAdd])
    setLookupResult(null)
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
        {['details', 'scenes', 'characters', 'team', ...((config.useAuditions === true || config.useAuditions === 'true') ? ['auditions'] : [])].map(t => (
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

          {/* Curtain times per day */}
          <div className="field" style={{ marginBottom: '1.25rem' }}>
            <label>Curtain times <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>— per show date</span></label>
            <CurtainTimesEditor
              curtainTimes={config.curtainTimes || {}}
              showDates={config.showDates}
              onChange={v => setC('curtainTimes', v)}
            />
          </div>
          <div className="field" style={{ marginBottom: '1.25rem' }}>
            <label>Google Calendar ID (optional)</label>
            <input type="text" value={config.calendarId} onChange={e => setC('calendarId', e.target.value)}
              placeholder="c_abc123...@group.calendar.google.com" />
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Share your calendar with altius-qc-functions@altius-project-hub.iam.gserviceaccount.com (Make changes to events), then paste the Calendar ID here.
            </p>
          </div>
          {/* Audition management toggle */}
          <div style={{ marginBottom: '1.25rem', padding: '12px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Audition management</p>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                {config.useAuditions === true ? 'Enabled — Auditions tab is active' : 'Disabled — enable to add audition form, profiles, and AI materials'}
              </p>
            </div>
            <button className="btn btn-sm"
              onClick={() => setC('useAuditions', config.useAuditions === true ? false : true)}
              style={config.useAuditions === true
                ? { background: 'var(--green-bg)', color: 'var(--green-text)', borderColor: 'transparent', fontWeight: 500 }
                : {}}>
              {config.useAuditions === true ? '✓ On' : 'Enable'}
            </button>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
            <p className="muted" style={{ margin: 0 }}>These appear in the scene dropdown when logging notes.</p>
            <button className="btn btn-sm" onClick={lookupScenes} disabled={lookingUpScenes || !config.title}
              style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', borderColor: 'transparent', fontWeight: 500, flexShrink: 0 }}>
              {lookingUpScenes ? '✨ Looking up…' : '✨ Auto-populate from show'}
            </button>
          </div>
          {sceneLookupResult && (
            <div style={{ background: 'var(--blue-bg)', border: '0.5px solid var(--blue-text)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--blue-text)', marginBottom: 8 }}>
                ✨ Found {sceneLookupResult.scenes.length} scenes for <em>{sceneLookupResult.showTitle}</em>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {sceneLookupResult.scenes.map(name => {
                  const added = config.scenes.includes(name)
                  return (
                    <button key={name} type="button"
                      onClick={() => {
                        if (added) setC('scenes', config.scenes.filter(s => s !== name))
                        else setC('scenes', [...config.scenes, name])
                      }}
                      style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                        border: '0.5px solid var(--blue-text)',
                        background: added ? 'var(--blue-text)' : 'transparent',
                        color: added ? 'var(--bg)' : 'var(--blue-text)'
                      }}>
                      {added ? '✓ ' : ''}{name}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setC('scenes', [...new Set([...config.scenes, ...sceneLookupResult.scenes])])}>Add all</button>
                <button className="btn btn-sm" onClick={() => setSceneLookupResult(null)}>Dismiss</button>
              </div>
            </div>
          )}
          <TagInput label="Scenes / acts" values={config.scenes} onChange={v => setC('scenes', v)} placeholder="e.g. Act 1 Scene 2" />
          <button className="btn btn-primary mt2" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save scenes'}
          </button>
        </div>
      )}

      {activeTab === 'characters' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
            <p className="muted" style={{ margin: 0 }}>
              These appear in the cast member autocomplete. Click <strong>Edit</strong> on any entry to add email addresses or mark it as a group.
            </p>
            <button className="btn btn-sm" onClick={lookupCast} disabled={lookingUpCast || !config.title}
              style={{ background: 'var(--purple-bg)', color: 'var(--purple-text)', borderColor: 'transparent', fontWeight: 500, flexShrink: 0 }}>
              {lookingUpCast ? '✨ Looking up…' : '✨ Auto-populate from show'}
            </button>
          </div>

          {lookupResult && (
            <LookupResultPanel
              result={lookupResult}
              existing={config.characters}
              onApply={applyLookupResult}
              onDismiss={() => setLookupResult(null)}
            />
          )}
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

          {/* ── SMS NOTIFICATIONS ───────────────────────────────── */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>📱 SMS Notifications</p>
            <p className="muted" style={{ fontSize: 13, marginBottom: '1rem' }}>
              These people receive automatic SMS alerts on show day — 1 hour before curtain, and on demand. Add your Stage Manager first.
            </p>
            {(config.notificationContacts || []).map((contact, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 500, flex: '0 0 auto', minWidth: 100 }}>{contact.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>{contact.smsGateway || contact.phone || 'No number'}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green-text)', flex: '0 0 auto' }}>
                  {contact.role || 'Staff'}
                </span>
                <button className="btn btn-sm btn-danger" onClick={() => {
                  const updated = config.notificationContacts.filter((_, idx) => idx !== i)
                  setC('notificationContacts', updated)
                }} style={{ flex: '0 0 auto' }}>✕</button>
              </div>
            ))}
            <NotificationContactForm onAdd={contact => setC('notificationContacts', [...(config.notificationContacts || []), contact])} />
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save notification contacts'}
              </button>
            </div>
          </div>

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
