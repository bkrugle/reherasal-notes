import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const SHOW_DAY_QUICK = [
  'House is open 🏠',
  'Cast to stage! 🎭',
  '5 minutes to places! ⏱',
  'Places please! 🎬',
  'Intermission — 15 minutes 🕐',
  'Act 2 — places please!',
  'Strike call — all hands 🔧',
]

const REHEARSAL_QUICK = [
  'Rehearsal starting in 5 minutes',
  'Please report to the stage',
  'Director notes in the house',
  'We are on a short break ☕',
  'Back from break — places!',
]

export default function CustomAlertPanel({ sheetId, production, isShowDay = false }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [scheduled, setScheduled] = useState(null)
  const timerRef = useRef(null)

  // Build recipient list from SharedWith + notificationContacts
  const sharedWith = production?.sharedWith || []
  const notificationContacts = (() => {
    try { return JSON.parse(production?.config?.notificationContacts || '[]') } catch { return [] }
  })()

  // Count all recipients who have a contact method — don't deduplicate by topic
  const allRecipients = []

  if (production?.config?.directorNtfyTopic || production?.config?.directorPhone) {
    allRecipients.push({ name: production.config.directorName || 'Director' })
  }
  sharedWith.forEach(m => {
    if (m.ntfyTopic || m.phone) allRecipients.push({ name: m.name })
  })
  notificationContacts.forEach(c => {
    if (c.ntfyTopic || c.smsGateway || c.phone) allRecipients.push({ name: c.name })
  })

  async function send(msg = message, alertTarget = 'staff') {
    if (!msg.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await api.sendCustomAlert({ sheetId, message: msg, alertTarget })
      setResult(res)
      setMessage('')
      setScheduledTime('')
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setSending(false)
    }
  }

  function scheduleAlert() {
    if (!scheduledTime || !message.trim()) return
    clearTimeout(timerRef.current)
    const [h, m] = scheduledTime.split(':').map(Number)
    const fireAt = new Date()
    fireAt.setHours(h, m, 0, 0)
    const msUntil = fireAt - new Date()
    if (msUntil <= 0) { alert('That time has already passed!'); return }
    const msgToSend = message
    timerRef.current = setTimeout(async () => {
      await send(msgToSend, 'staff')
      setScheduled(null)
    }, msUntil)
    setScheduled({ time: scheduledTime, message: msgToSend })
    setMessage('')
    setScheduledTime('')
  }

  function cancelScheduled() {
    clearTimeout(timerRef.current)
    setScheduled(null)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const quickMessages = isShowDay ? SHOW_DAY_QUICK : REHEARSAL_QUICK

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        className="btn btn-full"
        onClick={() => { setOpen(o => !o); setResult(null) }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
        <span style={{ fontWeight: 500 }}>📢 Custom alert</span>
        <span style={{ fontSize: 16 }}>{open ? '▲' : '▼'}</span>
      </button>

      {scheduled && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--amber-bg)', border: '0.5px solid var(--amber-text)',
          borderRadius: 'var(--radius)', padding: '8px 12px', marginTop: 8, fontSize: 13 }}>
          <div>
            <p style={{ fontWeight: 500, color: 'var(--amber-text)', margin: 0 }}>⏰ Scheduled for {scheduled.time}</p>
            <p style={{ color: 'var(--text2)', margin: 0, fontSize: 12 }}>{scheduled.message}</p>
          </div>
          <button className="btn btn-sm btn-danger" onClick={cancelScheduled}>Cancel</button>
        </div>
      )}

      {open && (
        <div style={{ border: '0.5px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 var(--radius) var(--radius)', padding: '1rem' }}>

          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Quick messages
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {quickMessages.map(q => (
              <button key={q} className="btn btn-sm"
                onClick={() => setMessage(q)}
                style={{ fontSize: 12, background: message === q ? 'var(--bg2)' : 'transparent' }}>
                {q}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>Message</label>
            <textarea rows={2} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Type a custom message…"
              style={{ fontSize: 14, resize: 'vertical' }} />
          </div>

          {allRecipients.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                Sends to: {allRecipients.map(r => r.name).join(', ')}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label style={{ fontSize: 11 }}>Schedule for (optional)</label>
              <input type="time" value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                style={{ fontSize: 13, padding: '5px 8px' }} />
            </div>
            {scheduledTime && (
              <button className="btn btn-sm" onClick={scheduleAlert}
                disabled={!message.trim()} style={{ marginBottom: 2 }}>
                Schedule ⏰
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            <button className="btn btn-sm" onClick={() => send(message, 'staff')} disabled={sending || !message.trim()}
              style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 12 }}>
              {sending ? '…' : '📲 Alert Staff'}
            </button>
            <button className="btn btn-sm" onClick={() => send(message, 'cast')} disabled={sending || !message.trim()}
              style={{ background: 'var(--amber-bg)', color: 'var(--amber-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 12 }}>
              {sending ? '…' : '⚠ Alert Cast'}
            </button>
            <button className="btn btn-sm" onClick={() => send(message, 'all')} disabled={sending || !message.trim()}
              style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 12 }}>
              {sending ? '…' : '🔔 Alert All'}
            </button>
          </div>

          {result && (
            <div style={{ marginTop: 10, fontSize: 13,
              background: result.error ? 'var(--red-bg)' : 'var(--bg2)',
              border: `0.5px solid ${result.error ? 'var(--red-text)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', padding: '8px 12px' }}>
              {result.error
                ? <p style={{ color: 'var(--red-text)' }}>✗ {result.error}</p>
                : <>
                  {result.alerted?.length > 0 && <p style={{ color: 'var(--green-text)', margin: 0 }}>✓ Sent to: {result.alerted.join(', ')}</p>}
                  {result.failed?.length > 0 && <p style={{ color: 'var(--red-text)', margin: 0 }}>✗ Failed: {result.failed.map(f => f.name).join(', ')}</p>}
                </>
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}
