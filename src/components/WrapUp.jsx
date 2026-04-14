import { useState } from 'react'
import { castNameList, getEmailsForCast } from '../lib/castUtils'
import { api } from '../lib/api'

const STEPS = ['Attendance', 'Notes review', 'Send preview', 'Done']

export default function WrapUp({ notes, characters, production, session, sheetId, onUpdated, onClose }) {
  const [step, setStep] = useState(0)
  const [attendance, setAttendance] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState({})
  const [selectedCast, setSelectedCast] = useState(() => {
    // Pre-select cast members who have open notes and emails
    const names = new Set(notes.filter(n => n.cast && !n.resolved).map(n => n.cast))
    const result = {}
    names.forEach(name => {
      const emails = getEmailsForCast(name, characters)
      result[name] = emails.length > 0
    })
    return result
  })

  const today = new Date().toISOString().slice(0, 10)
  const todayNotes = notes.filter(n => n.date === today)
  const openNotes = [...notes.filter(n => !n.resolved)].sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0))
  const highNotes = openNotes.filter(n => n.priority === 'high')
  const charNames = castNameList(characters)
  const dateLabel = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  const senderName = session?.name || production?.config?.directorName || ''
  const senderEmail = session?.email || production?.config?.directorEmail || ''
  const productionTitle = production?.config?.title || 'Production'

  function toggleAttendance(name) {
    setAttendance(a => ({ ...a, [name]: !a[name] }))
  }

  function markAllPresent() {
    const a = {}
    charNames.forEach(n => { a[n] = false }) // false = present (not absent)
    setAttendance(a)
  }

  function isAbsent(name) { return attendance[name] === true }

  const [sendErrors, setSendErrors] = useState({}) // name -> error message

  async function sendSelected() {
    setSending(true)
    setSendErrors({})
    const toSend = Object.entries(selectedCast).filter(([, sel]) => sel).map(([name]) => name)
    for (const name of toSend) {
      const castNotes = openNotes.filter(n => n.cast === name && !n.privateNote)
      if (!castNotes.length) continue
      const emails = getEmailsForCast(name, characters)
      if (!emails.length) {
        setSendErrors(e => ({ ...e, [name]: 'No email address on file' }))
        continue
      }
      try {
        await api.sendCastNotes({
          to: emails, castName: name, notes: castNotes,
          productionTitle, directorName: senderName, directorEmail: senderEmail
        })
        setSent(s => ({ ...s, [name]: true }))
      } catch (e) {
        setSendErrors(errs => ({ ...errs, [name]: e.message || 'Send failed' }))
      }
    }
    setSending(false)
    setStep(3)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg3)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Rehearsal wrap-up</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{dateLabel}</span>
        </div>
        <button className="btn btn-sm" onClick={onClose}>Exit</button>
      </div>

      {/* Step indicator */}
      <div style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: i <= step ? 'var(--text)' : 'var(--bg3)',
                border: '0.5px solid ' + (i <= step ? 'transparent' : 'var(--border2)'),
                color: i <= step ? 'var(--bg)' : 'var(--text3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600
              }}>{i < step ? '✓' : i + 1}</div>
              <span style={{ fontSize: 12, color: i === step ? 'var(--text)' : 'var(--text3)', fontWeight: i === step ? 500 : 400, whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: '0.5px', background: 'var(--border)', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {/* Step 0: Attendance */}
        {step === 0 && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '1rem' }}>
              Confirm who was present at tonight's rehearsal.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
              <button className="btn btn-sm" onClick={markAllPresent}>Mark all present</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6, marginBottom: '1.5rem' }}>
              {charNames.map(name => (
                <div key={name} onClick={() => toggleAttendance(name)}
                  style={{
                    padding: '8px 10px', borderRadius: 'var(--radius)',
                    border: '0.5px solid ' + (isAbsent(name) ? 'var(--red-text)' : 'var(--green-text)'),
                    background: isAbsent(name) ? 'var(--red-bg)' : 'var(--green-bg)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                  <span style={{ fontWeight: 500, fontSize: 13, color: isAbsent(name) ? 'var(--red-text)' : 'var(--green-text)' }}>
                    {isAbsent(name) ? '✗' : '✓'} {name}
                  </span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setStep(1)}>Next → Notes review</button>
          </div>
        )}

        {/* Step 1: Notes review */}
        {step === 1 && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="stats-bar" style={{ marginBottom: '1rem' }}>
              <div className="stat"><div className="stat-n">{todayNotes.length}</div><div className="stat-l">logged tonight</div></div>
              <div className="stat"><div className="stat-n">{openNotes.length}</div><div className="stat-l">total open</div></div>
              <div className="stat"><div className="stat-n" style={{ color: highNotes.length > 0 ? 'var(--red-text)' : undefined }}>{highNotes.length}</div><div className="stat-l">high priority</div></div>
              <div className="stat"><div className="stat-n">{notes.filter(n => n.resolved).length}</div><div className="stat-l">resolved</div></div>
            </div>

            {highNotes.length > 0 && (
              <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--red-text)' }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--red-text)', marginBottom: 8 }}>★ High priority — fix before next rehearsal</p>
                {highNotes.map(n => (
                  <div key={n.id} style={{ fontSize: 13, padding: '5px 0', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 8 }}>
                    <span className="pdot pdot-high" style={{ marginTop: 4, flexShrink: 0 }} />
                    <div>
                      {n.cast && <span style={{ fontWeight: 500, marginRight: 6 }}>{n.cast}</span>}
                      <span>{n.text}</span>
                      {n.privateNote && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--purple-text)' }}>🔒</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.5rem' }}>
              Review notes in the main app before proceeding to send. Private notes will not be sent.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>Next → Send preview</button>
            </div>
          </div>
        )}

        {/* Step 2: Send preview */}
        {step === 2 && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '1rem' }}>
              Select cast members to send their notes to. Private notes are excluded automatically.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
              {[...new Set(openNotes.filter(n => n.cast).map(n => n.cast))].sort().map(name => {
                const castNotes = openNotes.filter(n => n.cast === name && !n.privateNote)
                const privateNotes = openNotes.filter(n => n.cast === name && n.privateNote)
                const emails = getEmailsForCast(name, characters)
                const hasEmail = emails.length > 0
                if (!castNotes.length && !privateNotes.length) return null
                return (
                  <div key={name} className="card" style={{ opacity: !hasEmail ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox"
                        checked={selectedCast[name] || false}
                        onChange={e => setSelectedCast(s => ({ ...s, [name]: e.target.checked }))}
                        disabled={!hasEmail}
                        style={{ width: 16, height: 16 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                          {castNotes.length} note{castNotes.length !== 1 ? 's' : ''} to send
                          {privateNotes.length > 0 && ` · ${privateNotes.length} private (excluded)`}
                        </span>
                      </div>
                      {!hasEmail && <span style={{ fontSize: 11, color: 'var(--amber-text)' }}>no email</span>}
                      {sent[name] && <span style={{ fontSize: 11, color: 'var(--green-text)', fontWeight: 500 }}>✓ Sent</span>}
                      {!getEmailsForCast(name, characters).length && (
                        <span style={{ fontSize: 11, color: 'var(--amber-text)', fontWeight: 500 }}>⚠ No email</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={sendSelected} disabled={sending}>
                {sending ? 'Sending…' : 'Send selected & finish'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div style={{ maxWidth: 500, margin: '2rem auto', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: '1rem' }}>🎭</div>
            <p style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Rehearsal wrapped!</p>
            <p style={{ color: 'var(--text2)', marginBottom: Object.keys(sendErrors).length ? '1rem' : '2rem', lineHeight: 1.6 }}>
              {Object.values(sent).filter(Boolean).length > 0
                ? `Notes sent to ${Object.values(sent).filter(Boolean).length} cast member${Object.values(sent).filter(Boolean).length !== 1 ? 's' : ''}.`
                : 'No notes were sent tonight.'}
              {' '}See you at the next rehearsal!
            </p>

            {Object.keys(sendErrors).length > 0 && (
              <div style={{
                background: 'var(--red-bg)', border: '0.5px solid var(--red-text)',
                borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left'
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-text)', marginBottom: 8 }}>
                  ⚠ {Object.keys(sendErrors).length} send failure{Object.keys(sendErrors).length !== 1 ? 's' : ''} — fix in Setup → Characters:
                </p>
                {Object.entries(sendErrors).map(([name, msg]) => (
                  <div key={name} style={{ fontSize: 12, color: 'var(--red-text)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>{name}</span>
                    <span style={{ opacity: 0.8 }}>{msg}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-primary btn-full" onClick={onClose}>Back to app</button>
          </div>
        )}
      </div>
    </div>
  )
}
