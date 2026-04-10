import { useState } from 'react'
import { castName, castEmails, castMembers, isGroup, normalizeCast } from '../lib/castUtils'

function EmailList({ emails, onChange }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (v && !emails.includes(v)) onChange([...emails, v])
    setInput('')
  }
  function remove(e) { onChange(emails.filter(x => x !== e)) }
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="email" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add email address…"
          style={{ fontSize: 13, padding: '5px 8px' }} />
        <button type="button" className="btn btn-sm" onClick={add}>Add</button>
      </div>
      {emails.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {emails.map(e => (
            <span key={e} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '2px 8px',
              background: 'var(--blue-bg)', color: 'var(--blue-text)',
              borderRadius: 20
            }}>
              {e}
              <button type="button" onClick={() => remove(e)}
                style={{ background: 'none', border: 'none', color: 'var(--blue-text)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberSelector({ members, allNames, onChange }) {
  const available = allNames.filter(n => !members.includes(n))
  const [input, setInput] = useState('')

  function add(name) {
    if (name && !members.includes(name)) onChange([...members, name])
    setInput('')
  }
  function remove(n) { onChange(members.filter(x => x !== n)) }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input.trim()) } }}
          placeholder="Add cast member to group…"
          list="member-selector-list"
          style={{ fontSize: 13, padding: '5px 8px' }} />
        <datalist id="member-selector-list">
          {available.map(n => <option key={n} value={n} />)}
        </datalist>
        <button type="button" className="btn btn-sm" onClick={() => add(input.trim())}>Add</button>
      </div>
      {members.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {members.map(m => (
            <span key={m} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '2px 8px',
              background: 'var(--gray-bg)', color: 'var(--gray-text)',
              border: '0.5px solid var(--border)', borderRadius: 20
            }}>
              {m}
              <button type="button" onClick={() => remove(m)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function CastEntry({ entry, allNames, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const name = castName(entry)
  const emails = castEmails(entry)
  const members = castMembers(entry)
  const group = isGroup(entry)

  return (
    <div style={{
      background: 'var(--bg)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius)',
      marginBottom: 6,
      overflow: 'hidden'
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        {group && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--purple-bg)', color: 'var(--purple-text)', flexShrink: 0 }}>
            GROUP
          </span>
        )}
        {emails.length > 0 && !group && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--blue-bg)', color: 'var(--blue-text)', flexShrink: 0 }}>
            {emails.length} email{emails.length !== 1 ? 's' : ''}
          </span>
        )}
        <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{name}</span>
        <button type="button" className="btn btn-sm"
          onClick={() => setExpanded(e => !e)}
          style={{ fontSize: 11, padding: '3px 8px' }}>
          {expanded ? 'Done' : 'Edit'}
        </button>
        <button type="button" onClick={onRemove}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>×</button>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div style={{ padding: '0 10px 10px', borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
          {/* Group toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input type="checkbox" id={`group-${name}`} checked={group}
              onChange={e => onChange({ ...entry, isGroup: e.target.checked, name, emails, members })}
              style={{ width: 15, height: 15, cursor: 'pointer' }} />
            <label htmlFor={`group-${name}`} style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', marginBottom: 0 }}>
              This is a group (e.g. Ensemble, Dance Corps)
            </label>
          </div>

          {/* Email addresses */}
          <div style={{ marginBottom: group ? 10 : 0 }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 2 }}>
              Email addresses {group ? '(sent to all when group is selected)' : '(for sending notes)'}
            </p>
            <EmailList
              emails={emails}
              onChange={newEmails => onChange({ ...entry, name, emails: newEmails, members, isGroup: group })}
            />
          </div>

          {/* Group members */}
          {group && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 2 }}>
                Members (notes sent to members' individual emails too)
              </p>
              <MemberSelector
                members={members}
                allNames={allNames.filter(n => n !== name)}
                onChange={newMembers => onChange({ ...entry, name, emails, members: newMembers, isGroup: group })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CastManager({ characters, onChange, label, placeholder }) {
  const [input, setInput] = useState('')
  const normalized = normalizeCast(characters)
  const allNames = normalized.map(castName)

  function add() {
    const v = input.trim()
    if (!v || allNames.includes(v)) return
    onChange([...normalized, { name: v, emails: [], members: [], isGroup: false }])
    setInput('')
  }

  function update(i, updated) {
    const next = [...normalized]
    next[i] = updated
    onChange(next)
  }

  function remove(i) {
    onChange(normalized.filter((_, idx) => idx !== i))
  }

  return (
    <div className="field" style={{ marginBottom: '1rem' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder} />
        <button type="button" className="btn btn-sm" onClick={add}>Add</button>
      </div>
      {normalized.length > 0 && (
        <div>
          {normalized.map((entry, i) => (
            <CastEntry
              key={castName(entry) + i}
              entry={entry}
              allNames={allNames}
              onChange={updated => update(i, updated)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
