import { useState, useEffect } from 'react'
import { getNotesForUser, FULL_ACCESS_ROLES } from '../lib/castUtils'

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function LoginGreetingModal({ session, notes, onClose, onReviewNotes }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(t)
  }, [])

  if (!visible || !session) return null

  const name = session.name || ''
  const staffRole = session.staffRole || ''
  const firstName = name.split(' ')[0] || 'there'
  const timeOfDay = getTimeOfDay()

  const isFullAccess = FULL_ACCESS_ROLES.includes(staffRole) ||
    session.role === 'admin' || session.role === 'member'

  const myNotes = getNotesForUser(notes, session)
  const highPriority = myNotes.filter(n => n.priority === 'high')

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  function handleReview() {
    setVisible(false)
    setTimeout(() => { onClose(); onReviewNotes() }, 300)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s'
    }} onClick={handleClose}>
      <div style={{
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.75rem',
        maxWidth: 380,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'transform 0.3s',
      }} onClick={e => e.stopPropagation()}>

        {/* Greeting */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎭</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            Good {timeOfDay}, {firstName}!
          </h2>
          {staffRole && (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>{staffRole}</p>
          )}
        </div>

        {/* Note summary */}
        <div style={{
          background: myNotes.length > 0 ? 'var(--amber-bg)' : 'var(--green-bg)',
          borderRadius: 'var(--radius)',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          border: `0.5px solid ${myNotes.length > 0 ? 'var(--amber-text)' : 'var(--green-text)'}`,
        }}>
          {myNotes.length === 0 ? (
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--green-text)' }}>✅ All clear!</p>
              <p style={{ fontSize: 13, color: 'var(--green-text)', marginTop: 4, opacity: 0.8 }}>
                No open notes assigned to you.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--amber-text)' }}>
                You have {myNotes.length} open note{myNotes.length !== 1 ? 's' : ''}
              </p>
              {highPriority.length > 0 && (
                <p style={{ fontSize: 13, color: 'var(--red-text)', marginTop: 4, fontWeight: 500 }}>
                  ⚠ {highPriority.length} high priority
                </p>
              )}
              {!isFullAccess && (
                <p style={{ fontSize: 12, color: 'var(--amber-text)', marginTop: 4, opacity: 0.8 }}>
                  Tagged to you or {staffRole}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          {myNotes.length > 0 && (
            <button
              onClick={handleReview}
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius)',
                background: 'var(--accent)', color: 'white', border: 'none',
                fontSize: 15, fontWeight: 600, cursor: 'pointer'
              }}>
              Review notes now →
            </button>
          )}
          <button
            onClick={handleClose}
            style={{
              width: '100%', padding: '10px', borderRadius: 'var(--radius)',
              background: 'transparent', color: 'var(--text3)',
              border: '0.5px solid var(--border)',
              fontSize: 14, cursor: 'pointer'
            }}>
            {myNotes.length === 0 ? 'Let\'s go!' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  )
}
