import { useState } from 'react'
import { api } from '../lib/api'
import { castName, castEmails, castMembers, isGroup, castNameList, getEmailsForCast } from '../lib/castUtils'

export default function SendTab({ notes, characters, characterNames, production, session }) {
  const [storedEmails, setStoredEmails] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rn_emails') || '{}') } catch { return {} }
  })
  const [sending, setSending] = useState({})
  const [sent, setSent] = useState({})
  const [errors, setErrors] = useState({})

  const senderName = session?.name || production?.config?.directorName || ''
  const senderEmail = session?.email || production?.config?.directorEmail || ''
  const productionTitle = production?.config?.title || 'Production'

  // Get all names to display — from characters config + any names that appear in notes
  const configNames = castNameList(characters)
  const noteNames = [...new Set(notes.filter(n => n.cast).map(n => n.cast))]
  const allNames = [...new Set([...configNames, ...noteNames])].sort()

  function storeEmail(name, val) {
    const updated = { ...storedEmails, [name]: val }
    setStoredEmails(updated)
    localStorage.setItem('rn_emails', JSON.stringify(updated))
  }

  // Get emails for a cast entry — from cast config first, then stored emails
  function getEmails(name) {
    // Try from cast config (includes group member resolution)
    const configEmails = getEmailsForCast(name, characters)
    if (configEmails.length) return configEmails
    // Fall back to manually stored email
    const stored = storedEmails[name]
    return stored ? [stored] : []
  }

  function getStoredEmail(name) {
    return storedEmails[name] || ''
  }

  // Check if emails come from config (not manual)
  function hasConfigEmails(name) {
    return getEmailsForCast(name, characters).length > 0
  }

  async function sendNotes(name) {
    const openNotes = notes.filter(n => n.cast === name && !n.resolved)
    if (!openNotes.length) return
    const emails = getEmails(name)
    if (!emails.length) {
      setErrors(e => ({ ...e, [name]: 'Enter an email address first' }))
      return
    }
    setSending(s => ({ ...s, [name]: true }))
    setErrors(e => ({ ...e, [name]: '' }))
    try {
      // Send to all emails for this cast entry
      await Promise.all(emails.map(email =>
        api.sendCastNotes({
          to: email,
          castName: name,
          notes: openNotes,
          productionTitle,
          directorName: senderName,
          directorEmail: senderEmail
        })
      ))
      setSent(s => ({ ...s, [name]: true }))
      setTimeout(() => setSent(s => ({ ...s, [name]: false })), 3000)
    } catch (e) {
      setErrors(err => ({ ...err, [name]: e.message }))
    } finally {
      setSending(s => ({ ...s, [name]: false }))
    }
  }

  function composeFallback(name) {
    const openNotes = notes.filter(n => n.cast === name && !n.resolved)
    if (!openNotes.length) return
    const emails = getEmails(name)
    const to = emails.join(',')
    const lines = [`Hi ${name.split(' ')[0]},\n\nHere are your notes:\n`]
    openNotes.forEach(n => { lines.push(`• [${n.category}] ${n.text}`) })
    lines.push(`\n— ${senderName || 'Your Director'}`)
    const subject = encodeURIComponent(`Your notes — ${productionTitle}`)
    const body = encodeURIComponent(lines.join('\n'))
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  if (!allNames.length) {
    return <div className="empty">No cast members yet. Add them in Setup → Characters to send notes.</div>
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: '1.25rem', fontSize: 13, lineHeight: 1.6 }}>
        Send notes directly to cast members. Email addresses set in Setup → Characters are used automatically. You can also enter addresses manually below.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {allNames.map(name => {
          const entry = characters.find(c => castName(c) === name)
          const group = entry ? isGroup(entry) : false
          const groupMembers = entry ? castMembers(entry) : []
          const configEmails = getEmailsForCast(name, characters)
          const openNotes = notes.filter(n => n.cast === name && !n.resolved)
          const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

          return (
            <div key={name} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: group ? 'var(--purple-bg)' : 'var(--blue-bg)',
                  color: group ? 'var(--purple-text)' : 'var(--blue-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, flexShrink: 0
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
                    {group && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--purple-bg)', color: 'var(--purple-text)' }}>GROUP</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {openNotes.length} open note{openNotes.length !== 1 ? 's' : ''}
                    {group && groupMembers.length > 0 && ` · ${groupMembers.length} members`}
                  </div>
                </div>
              </div>

              {/* Show configured emails or manual input */}
              {configEmails.length > 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.5 }}>
                  {configEmails.length === 1
                    ? configEmails[0]
                    : `${configEmails.length} recipients configured`}
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--blue-text)' }}>from setup</span>
                </div>
              ) : (
                <input
                  type="email"
                  placeholder="email address"
                  value={getStoredEmail(name)}
                  onChange={e => storeEmail(name, e.target.value)}
                  style={{ fontSize: 13, padding: '6px 9px', marginBottom: 6 }}
                />
              )}

              {/* Group members preview */}
              {group && groupMembers.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                  {groupMembers.slice(0, 3).join(', ')}{groupMembers.length > 3 ? ` +${groupMembers.length - 3} more` : ''}
                </div>
              )}

              {errors[name] && (
                <p style={{ fontSize: 12, color: 'var(--red-text)', marginBottom: 6 }}>{errors[name]}</p>
              )}

              {openNotes.length > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => sendNotes(name)}
                  disabled={sending[name]}
                  style={{
                    width: '100%',
                    background: sent[name] ? 'var(--green-bg)' : 'var(--blue-bg)',
                    color: sent[name] ? 'var(--green-text)' : 'var(--blue-text)',
                    borderColor: 'transparent', fontWeight: 500
                  }}
                >
                  {sending[name] ? 'Sending…' : sent[name]
                    ? `✓ Sent${configEmails.length > 1 ? ` to ${configEmails.length}` : ''}!`
                    : `Send notes${configEmails.length > 1 ? ` (${configEmails.length} recipients)` : ''}`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
