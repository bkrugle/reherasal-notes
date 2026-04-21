import { useState, useRef } from 'react'
import { castName, castEmails, castMembers, isGroup, normalizeCast } from '../lib/castUtils'

function EmailList({ emails, onChange }) {
  const [input, setInput] = useState('')
  function add() {
    const items = input.split(',').map(v => v.trim()).filter(Boolean)
    if (!items.length) return
    const unique = items.filter(v => !emails.includes(v))
    if (unique.length) onChange([...emails, ...unique])
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
          {members.map(n => (
            <span key={n} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '2px 8px',
              background: 'var(--bg2)', borderRadius: 20
            }}>
              {n}
              <button type="button" onClick={() => remove(n)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
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
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg2)', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{name || '(unnamed)'}</span>
        {entry.castMember && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{entry.castMember}</span>}
        {emails.length > 0 && <span style={{ fontSize: 10, color: 'var(--blue-text)' }}>✉ {emails.length}</span>}
        {entry.phone && <span style={{ fontSize: 10, color: 'var(--green-text)' }}>📱</span>}
        {group && <span style={{ fontSize: 10, background: 'var(--purple-bg)', color: 'var(--purple-text)', padding: '1px 6px', borderRadius: 10 }}>group</span>}
        <button type="button" onClick={e => { e.stopPropagation(); onRemove() }}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>×</button>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '10px' }}>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 4 }}>Character name</p>
            <input type="text" value={name}
              onChange={e => onChange({ ...entry, name: e.target.value, emails, members, isGroup: group })}
              style={{ fontSize: 13 }} />
          </div>
          {!group && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 4 }}>Cast member (actor's real name)</p>
              <input type="text" value={entry.castMember || ''}
                onChange={e => onChange({ ...entry, name, emails, members, isGroup: group, castMember: e.target.value })}
                placeholder="e.g. Madison Bryant"
                style={{ fontSize: 13 }} />
            </div>
          )}
          {!group && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 4 }}>Email addresses</p>
              <EmailList emails={emails}
                onChange={newEmails => onChange({ ...entry, name, emails: newEmails, members, isGroup: group })} />
            </div>
          )}
          {!group && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 4 }}>
                Phone number <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(for show day SMS alerts)</span>
              </p>
              <input type="tel" value={entry.phone || ''}
                onChange={e => onChange({ ...entry, name, emails, members, isGroup: group, phone: e.target.value })}
                placeholder="e.g. 412-555-0100"
                style={{ fontSize: 13, marginBottom: 6 }} />
              <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Or use free email-to-SMS gateway:</p>
              <input type="text" value={entry.smsGateway || ''}
                onChange={e => onChange({ ...entry, name, emails, members, isGroup: group, smsGateway: e.target.value })}
                placeholder="e.g. 4125550100@vtext.com (Verizon)"
                style={{ fontSize: 13 }} />
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                AT&T: @txt.att.net · Verizon: @vtext.com · T-Mobile: @tmomail.net
              </p>
            </div>
          )}
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
      {expanded && (
        <div style={{ padding: '0 10px 8px' }}>
          <button type="button" className="btn btn-sm" onClick={() => setExpanded(false)}
            style={{ fontSize: 11, width: '100%', color: 'var(--text3)' }}>
            ↑ Collapse
          </button>
        </div>
      )}
    </div>
  )
}

// Parse CSV text into rows
function parseCSV(text) {
  const lines = text.trim().split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map(line => {
    const fields = []
    let current = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuote = !inQuote }
      else if (line[i] === ',' && !inQuote) { fields.push(current.trim()); current = '' }
      else current += line[i]
    }
    fields.push(current.trim())
    const row = {}
    header.forEach((h, i) => { row[h] = (fields[i] || '').replace(/^"|"$/g, '').trim() })
    return row
  }).filter(r => Object.values(r).some(v => v))
}

// Map header variants to canonical keys
function normalizeHeader(h) {
  h = h.toLowerCase().trim()
  if (h.includes('character') || h.includes('group name')) return 'character'
  if (h.includes('group') && h.includes('member')) return 'groupMembers'
  if (h.includes('cast') && h.includes('member')) return 'castMember'
  if (h.includes('actor') || h.includes('real name') || h.includes('performer')) return 'castMember'
  if (h.includes('phone') || h.includes('mobile') || h.includes('cell')) return 'phone'
  if (h.includes('email') || h.includes('e-mail')) return 'email'
  return h
}

function downloadTemplate() {
  const csv = [
    'Character/Group Name,Cast Member Name,Group Members,Phone,Email',
    'Cinderella,Jane Smith,,412-555-0100,jsmith@email.com',
    'Prince Charming,John Doe,,,jdoe@email.com',
    'Sopranos,,Emma Jones|Taylor Smith|Jordan Lee,,',
    'Altos,,Madison Brown|Ashley White,,',
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'cast-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function CastManager({ characters, onChange, label, placeholder }) {
  const [input, setInput] = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const fileRef = useRef(null)
  const normalized = normalizeCast(characters)
  const allNames = normalized.map(castName)

  function add() {
    const items = input.split(',').map(v => v.trim()).filter(Boolean)
    if (!items.length) return
    const newEntries = items
      .filter(v => !allNames.includes(v))
      .map(v => ({ name: v, emails: [], members: [], isGroup: false }))
    if (newEntries.length) onChange([...normalized, ...newEntries])
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

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const rows = parseCSV(text)
        if (!rows.length) { setUploadResult({ error: 'No data found in file.' }); return }

        // Normalize headers
        const normalizedRows = rows.map(row => {
          const out = {}
          Object.entries(row).forEach(([k, v]) => { out[normalizeHeader(k)] = v })
          return out
        })

        let added = 0, updated = 0
        const next = [...normalized]

        normalizedRows.forEach(row => {
          const charName = row.character || row.name || row.castMember || row.performer || ''
          const actorName = row.castMember || row.performer || row.actor || ''
          const groupMembers = row.groupMembers ? row.groupMembers.split('|').map(s => s.trim()).filter(Boolean) : []
          const isGroupRow = groupMembers.length > 0
          if (!charName) return

          const existing = next.findIndex(e => castName(e).toLowerCase() === charName.toLowerCase())
          const entry = existing >= 0 ? { ...next[existing] } : {
            name: charName, emails: [], members: [], isGroup: false
          }

          if (isGroupRow) {
            entry.isGroup = true
            entry.members = groupMembers
          } else {
            if (actorName && actorName !== charName) entry.castMember = actorName
            if (row.phone) entry.phone = row.phone
            if (row.email && !entry.emails.includes(row.email)) entry.emails = [...(entry.emails || []), row.email]
          }

          if (existing >= 0) { next[existing] = entry; updated++ }
          else { next.push(entry); added++ }
        })

        onChange(next)
        setUploadResult({ added, updated })
      } catch (e) {
        setUploadResult({ error: 'Could not parse file. Please use the CSV template.' })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="field" style={{ marginBottom: '1rem' }}>
      <label>{label}</label>

      {/* Upload strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>📋 Import from spreadsheet</span>
        <button type="button" className="btn btn-sm" onClick={downloadTemplate} style={{ fontSize: 11 }}>
          ↓ Template
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()} style={{ fontSize: 11 }}>
          ↑ Upload CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
          onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
      </div>

      {uploadResult && (
        <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 12,
          background: uploadResult.error ? 'var(--red-bg)' : 'var(--green-bg)',
          color: uploadResult.error ? 'var(--red-text)' : 'var(--green-text)' }}>
          {uploadResult.error
            ? `✗ ${uploadResult.error}`
            : `✓ Imported: ${uploadResult.added} added, ${uploadResult.updated} updated`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder} />
        <button type="button" className="btn btn-sm" onClick={add}>Add</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Separate multiple entries with commas</p>

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
