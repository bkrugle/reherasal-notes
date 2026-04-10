import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function SendTab({ notes, characters, production }) {
  const [emails, setEmails] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rn_emails') || '{}') } catch { return {} }
  })
  const [sending, setSending] = useState({})
  const [sent, setSent] = useState({})
  const [errors, setErrors] = useState({})

  const directorName = production?.config?.directorName || ''
  const directorEmail = production?.config?.directorEmail || ''
  const productionTitle = production?.config?.title || 'Production'

  function setEmail(name, val) {
    const updated = { ...emails, [name]: val }
    setEmails(updated)
    localStorage.setItem('rn_emails', JSON.stringify(updated))
  }

  async function sendNotes(name) {
    const openNotes = notes.filter(n => n.cast === name && !n.resolved)
    if (!openNotes.length) return
    const email = emails[name] || ''
    if (!email) { setErrors(e => ({ ...e, [name]: 'Enter an email address first' })); return }
    setSending(s => ({ ...s, [name]: true }))
    setErrors(e => ({ ...e, [name]: '' }))
    try {
      await api.sendCastNotes({
        to: email,
        castName: name,
        notes: openNotes,
        productionTitle,
        directorName,
        directorEmail
      })
      setSent(s => ({ ...s, [name]: true }))
      setTimeout(() => setSent(s => ({ ...s, [name]: false })), 3000)
    } catch (e) {
      setErrors(err => ({ ...err, [name]: e.message }))
    } finally {
      setSending(s => ({ ...s, [name]: false }))
    }
  }

  function composeFallback(name) {
    // Fallback mailto for when API isn't configured
    const openNotes = notes.filter(n => n.cast === name && !n.resolved)
    if (!openNotes.length) return
    const email = emails[name] || ''
    const lines = [`Hi ${name.split(' ')[0]},

Here are your notes:
`]
    openNotes.forEach(n => {
      lines.push(`• [${n.category}] ${n.text}`)
    })
    lines.push(`
— ${directorName || 'Your Director'}`)
    const subject = encodeURIComponent(`Your notes — ${productionTitle}`)
    const body = encodeURIComponent(lines.join('
'))
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  // All cast members who appear in notes OR are in characters list
  const allNames = [...new Set([
    ...characters,
    ...notes.filter(n => n.cast).map(n => n.cast)
  ])].sort()

  if (!allNames.length) {
    return <div className="empty">No cast members yet. Add them in production setup.</div>
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: '1.25rem', fontSize: 13, lineHeight: 1.6 }}>
        Enter each cast member's email address to enable the compose button. Addresses are saved locally in your browser. Clicking "Compose email" opens your default mail app with all their open notes pre-filled.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {allNames.map(name => {
          const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
          const openNotes = notes.filter(n => n.cast === name && !n.resolved)
          return (
            <div key={name} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'var(--blue-bg)', color: 'var(--blue-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, flexShrink: 0
                }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {openNotes.length} open note{openNotes.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <input
                type="email"
                placeholder="email address"
                value={emails[name] || ''}
                onChange={e => setEmail(name, e.target.value)}
                style={{ fontSize: 13, padding: '6px 9px' }}
              />
              {errors[name] && <p style={{ fontSize: 12, color: 'var(--red-text)', marginTop: 6 }}>{errors[name]}</p>}
              {openNotes.length > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => sendNotes(name)}
                  disabled={sending[name]}
                  style={{
                    marginTop: 8, width: '100%',
                    background: sent[name] ? 'var(--green-bg)' : 'var(--blue-bg)',
                    color: sent[name] ? 'var(--green-text)' : 'var(--blue-text)',
                    borderColor: 'transparent', fontWeight: 500
                  }}
                >
                  {sending[name] ? 'Sending…' : sent[name] ? '✓ Sent!' : `Send notes (${openNotes.length})`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
