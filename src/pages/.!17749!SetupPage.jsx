import { useState, useEffect, useRef } from 'react'
import AuditionMaterials from '../components/AuditionMaterials'
import { castNameList, normalizeCast } from '../lib/castUtils'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'
import AppShell from '../components/AppShell'
import ActsScenesManager from '../components/ActsScenesManager'
import CastManager from '../components/CastManager'
import { api } from '../lib/api'
import { applyAccentColor } from './ProductionApp'

// Parses showDates string into array of ISO date strings
function parseShowDates(showDates) {
  if (!showDates) return []
  try {
    const yearMatch = showDates.match(/(20\d{2})/)
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
          Found {result.characters.length} characters for <em>{result.showTitle}</em>
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

function TagInput({ label, values, onChange, placeholder }) {
  const [input, setInput] = useState('')

  function add() {
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

function TestButton({ topic, productionTitle }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  async function test() {
    setSending(true); setResult(null); setErrorMsg('')
    try {
      await api.sendTestNotification({ ntfyTopic: topic, productionTitle })
      setResult('success')
    } catch (e) {
      setResult('failed')
      setErrorMsg(e.message)
    }
    finally { setSending(false) }
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <button className="btn btn-sm" onClick={test} disabled={sending} style={{ fontSize: 11 }}>
        {sending ? '…' : '📲 Test'}
      </button>
      {result === 'success' && <span style={{ fontSize: 11, color: 'var(--green-text)' }}>✓ Sent!</span>}
      {result === 'failed' && <span style={{ fontSize: 11, color: 'var(--red-text)' }} title={errorMsg}>✗ {errorMsg || 'Failed'}</span>}
    </span>
  )
}

function NotificationContactForm({ onAdd, ntfyTopic, productionTitle }) {
  const [form, setForm] = useState({ name: '', role: 'Stage Manager', phone: '', smsGateway: '', ntfyTopic: '' })
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState(null)

  async function sendTest(topic) {
    setTestSending(true)
    setTestResult(null)
    try {
      await api.sendTestNotification({ ntfyTopic: topic, productionTitle })
      setTestResult('success')
    } catch (e) {
      setTestResult('failed')
    } finally {
      setTestSending(false)
    }
  }

  const carriers = [
    { label: 'Verizon', suffix: '@vtext.com' },
  ]

  function add() {
    if (!form.name.trim()) return
    if (!form.phone && !form.smsGateway) return
    const contact = { ...form }
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
            {['Stage Manager', 'Assistant SM', 'Asst. Director', 'Music Director', 'Choreographer', 'Director', 'Producer', 'Tech Director', 'Lights', 'Sound', 'Props', 'House Manager', 'Other'].map(r =>
              <option key={r} value={r}>{r}</option>
            )}
          </select>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Phone number</label>
        <input type="tel" value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="4125550100"
          autoComplete="off" />
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>SMS Gateway email <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(free — no Twilio needed)</span></label>
        <input type="text" value={form.smsGateway}
          onChange={e => setForm(f => ({ ...f, smsGateway: e.target.value }))}
          placeholder="e.g. 4125550100@vtext.com"
          autoComplete="off" />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {carriers.map(c => {
            const digits = form.phone.replace(/\D/g, '')
            const num = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
            const gw = num.length === 10 ? num + c.suffix : ''
            return (
              <button key={c.label} type="button" className="btn btn-sm"
                onClick={() => {
                  const d = form.phone.replace(/\D/g, '')
                  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
                  if (n.length === 10) setForm(f => ({ ...f, smsGateway: n + c.suffix }))
                  else alert(`Enter your 10-digit phone number first (got ${d.length} digits)`)
                }}
                style={{ fontSize: 11, opacity: gw ? 1 : 0.5 }}>
                {c.label} →
              </button>
            )
          })}
          <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            Note: Most carrier gateways (AT&T, T-Mobile, Sprint) were shut down in 2024-2025. Use ntfy push notifications instead.
          </p>
        </div>
        {form.smsGateway && (
          <p style={{ fontSize: 11, color: 'var(--green-text)', marginTop: 4 }}>✓ {form.smsGateway}</p>
        )}
      </div>
      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>📲 Push notifications (free, recommended)</p>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.5 }}>
          Install the free <strong>ntfy</strong> app on their phone, then subscribe to the topic below.
        </p>
        {ntfyTopic && (
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '8px 10px', marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Production topic:</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: 12, fontWeight: 600, flex: 1, wordBreak: 'break-all' }}>{ntfyTopic}</code>
              <button className="btn btn-sm" style={{ fontSize: 10, flexShrink: 0 }}
                onClick={() => navigator.clipboard?.writeText(ntfyTopic)}>Copy</button>
            </div>
          </div>
        )}
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Their ntfy topic</label>
          <input type="text" value={form.ntfyTopic}
            onChange={e => setForm(f => ({ ...f, ntfyTopic: e.target.value }))}
            placeholder={ntfyTopic || 'vhs-25thop3-xxxxxxxx'} />
        </div>
        {form.ntfyTopic && (
          <div style={{ marginBottom: 8 }}>
            <button className="btn btn-sm" onClick={() => sendTest(form.ntfyTopic)} disabled={testSending}>
              {testSending ? 'Sending…' : '📲 Send test notification'}
            </button>
            {testResult === 'success' && <span style={{ fontSize: 12, color: 'var(--green-text)', marginLeft: 8 }}>✓ Sent!</span>}
            {testResult === 'failed' && <span style={{ fontSize: 12, color: 'var(--red-text)', marginLeft: 8 }}>✗ Failed</span>}
          </div>
        )}
      </div>
      <button className="btn btn-primary btn-sm" onClick={add} disabled={!form.name || (!form.phone && !form.smsGateway && !form.ntfyTopic)}>
        + Add contact
      </button>
    </div>
  )
}

const STAFF_ROLES = ['Stage Manager', 'Assistant SM', 'Asst. Director', 'Music Director', 'Choreographer', 'Director', 'Producer', 'Tech Director', 'Lights', 'Sound', 'Props', 'House Manager', 'Other']

function RoleSelect({ value, onChange }) {
  const [custom, setCustom] = useState(!STAFF_ROLES.includes(value) && !!value)
  return (
    <div>
      {!custom ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }}>
            {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" className="btn btn-sm" onClick={() => setCustom(true)} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Custom</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="e.g. Fight Choreographer" style={{ flex: 1 }} />
          <button type="button" className="btn btn-sm" onClick={() => { setCustom(false); onChange('Stage Manager') }} style={{ fontSize: 11 }}>↩</button>
        </div>
      )}
    </div>
  )
}

// Shared pill renderer used by both director row and team member rows
function MemberPills({ role, staffRole, activated }) {
  return (
    <>
      {role === 'admin' && (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: 'var(--purple-bg)', color: 'var(--purple-text)',
          border: '0.5px solid var(--border)' }}>
          ★ Admin
        </span>
      )}
      {staffRole && (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: 'var(--bg2)', color: 'var(--text2)',
          border: '0.5px solid var(--border)' }}>
          {staffRole}
        </span>
      )}
      {!staffRole && role !== 'admin' && (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: 'var(--bg2)', color: 'var(--text2)',
          border: '0.5px solid var(--border)' }}>
          Member
        </span>
      )}
      {activated === false && (
        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 10,
          background: 'var(--amber-bg)', color: 'var(--amber-text)' }}>
          invite pending
        </span>
      )}
      {activated === true && (
        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 10,
          background: 'var(--green-bg)', color: 'var(--green-text)' }}>
          active
        </span>
      )}
    </>
  )
}

function TeamMemberRow({ member, index, onUpdate, onRemove, onResetPin, productionTitle }) {
  const [expanded, setExpanded] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)

  function savePin() {
    if (!newPin.trim()) return
    onResetPin(index, newPin.trim())
    setNewPin('')
    setPinSaved(true)
    setTimeout(() => setPinSaved(false), 2000)
  }

  return (
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{member.name}</span>
            <MemberPills role={member.role} staffRole={member.staffRole} activated={member.activated} />
            {member.ntfyTopic && <span style={{ fontSize: 11, color: 'var(--teal-text)' }}>📲</span>}
            {member.phone && <span style={{ fontSize: 11, color: 'var(--text3)' }}>📞</span>}
          </div>
          {member.email && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{member.email}</div>}
        </div>
        <button className="btn btn-sm" onClick={() => setExpanded(e => !e)} style={{ fontSize: 11, flexShrink: 0 }}>
          {expanded ? 'Done' : 'Edit'}
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => onRemove(index)} style={{ flexShrink: 0 }}>✕</button>
      </div>

      {expanded && (
        <div style={{ padding: '12px', borderTop: '0.5px solid var(--border)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="grid2" style={{ gap: 8 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Name</label>
              <input type="text" value={member.name} onChange={e => onUpdate(index, { ...member, name: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Email</label>
              <input type="email" value={member.email || ''} onChange={e => onUpdate(index, { ...member, email: e.target.value })} placeholder="optional" />
            </div>
          </div>
          <div className="grid2" style={{ gap: 8 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Staff role</label>
              <RoleSelect value={member.staffRole || 'Stage Manager'} onChange={v => onUpdate(index, { ...member, staffRole: v })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Phone <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
              <input type="tel" value={member.phone || ''} onChange={e => onUpdate(index, { ...member, phone: e.target.value })} placeholder="4125550100" />
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>ntfy push topic <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(for show day alerts)</span></label>
            <input type="text" value={member.ntfyTopic || ''} onChange={e => onUpdate(index, { ...member, ntfyTopic: e.target.value })} placeholder="vhs-showname-xxxxxxxx" />
            {member.ntfyTopic && <TestButton topic={member.ntfyTopic} productionTitle={productionTitle} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id={`admin-${index}`} checked={member.role === 'admin'}
              onChange={e => onUpdate(index, { ...member, role: e.target.checked ? 'admin' : 'member' })}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor={`admin-${index}`} style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', marginBottom: 0 }}>
              Admin access (can edit setup)
            </label>
          </div>
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Reset PIN</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={newPin} onChange={e => setNewPin(e.target.value)}
                placeholder="Enter new PIN" style={{ width: 140, fontSize: 13 }} />
              <button className="btn btn-sm" onClick={savePin} disabled={!newPin.trim()}>Set PIN</button>
              {pinSaved && <span style={{ fontSize: 12, color: 'var(--green-text)' }}>✓ Updated</span>}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Leave blank to keep current PIN.</p>
          </div>
          <button className="btn btn-sm" onClick={() => setExpanded(false)} style={{ fontSize: 11, color: 'var(--text3)' }}>↑ Collapse</button>
        </div>
      )}
    </div>
  )
}

function TeamTab({ config, setC, sharedWith, setSharedWith, newMember, setNewMember, addMember, removeMember, toggleMemberRole, save, saveTeam, saving, saved, session }) {
  const [addForm, setAddForm] = useState({ name: '', email: '', pin: '', staffRole: 'Stage Manager', phone: '', ntfyTopic: '', role: 'member' })

  function handleAdd() {
    if (!addForm.name.trim()) return
    const memberData = {
      name: addForm.name,
      email: addForm.email,
      pin: addForm.pin || undefined,
      staffRole: addForm.staffRole,
      phone: addForm.phone || undefined,
      ntfyTopic: addForm.ntfyTopic || undefined,
      role: addForm.role,
    }
    setSharedWith(sw => [...sw, memberData])
    if (addForm.ntfyTopic || addForm.phone) {
      const nc = { name: addForm.name, role: addForm.staffRole, phone: addForm.phone || '', ntfyTopic: addForm.ntfyTopic || '' }
      setC('notificationContacts', [...(config.notificationContacts || []), nc])
    }
    setAddForm({ name: '', email: '', pin: '', staffRole: 'Stage Manager', phone: '', ntfyTopic: '', role: 'member' })
  }

  function updateMember(i, updated) {
    const next = [...sharedWith]
    next[i] = updated
    setSharedWith(next)
  }

  function resetPin(i, pin) {
    const next = [...sharedWith]
    next[i] = { ...next[i], pin }
    setSharedWith(next)
  }

  // Director row — synthesized from session/config, always shown at top
  const directorName = session.name || config.directorName || ''
  const directorEmail = session.email || config.directorEmail || ''

  return (
    <div>
      {/* ntfy topic for production */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>📲 Push notification topic</p>
        {!config.ntfyTopic ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Generate a topic to enable free instant alerts via the ntfy app on show day.</p>
            <button className="btn btn-sm" onClick={() => {
              const topic = 'vhs-' + (config.title || 'show').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + '-' + Math.random().toString(36).slice(2, 10)
              setC('ntfyTopic', topic)
            }}>Generate topic</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
              <code style={{ fontSize: 12, flex: 1, wordBreak: 'break-all', color: 'var(--text2)' }}>{config.ntfyTopic}</code>
              <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => navigator.clipboard?.writeText(config.ntfyTopic)}>Copy</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Install the free ntfy app → Subscribe to this topic → receive show day alerts</p>
          </div>
        )}
      </div>

      {/* Team members list */}
      <div style={{ marginBottom: '1rem' }}>
        <p className="section-label" style={{ marginBottom: 8 }}>
          Team members ({sharedWith.length + 1})
        </p>

