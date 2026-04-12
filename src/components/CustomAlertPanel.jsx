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
  const [recipientIds, setRecipientIds] = useState([]) // empty = all
  const [scheduledTime, setScheduledTime] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [scheduled, setScheduled] = useState(null) // { time, message, timer }
  const timerRef = useRef(null)

  const contacts = (() => {
    try { return JSON.parse(production?.config?.notificationContacts || '[]') } catch { return [] }
  })()

  function toggleRecipient(i) {
    setRecipientIds(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    )
  }

  const allSelected = recipientIds.length === 0

  async function send(msg = message, ids = recipientIds) {
    if (!msg.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await api.sendCustomAlert({
        sheetId,
        message: msg,
        recipientIds: ids.length > 0 ? ids : undefined
      })
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
    const idsToSend = [...recipientIds]

    timerRef.current = setTimeout(async () => {
      await send(msgToSend, idsToSend)
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

      {/* Scheduled alert banner */}
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

          {/* Quick messages */}
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

          {/* Message */}
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Message</label>
            <textarea rows={2} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Type a custom message…"
              style={{ fontSize: 14, resize: 'vertical' }} />
          </div>

          {/* Recipients */}
          {contacts.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                Recipients
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button className="btn btn-sm"
                  onClick={() => setRecipientIds([])}
                  style={{ fontSize: 11, background: allSelected ? 'var(--bg2)' : 'transparent',
                    fontWeight: allSelected ? 600 : 400 }}>
                  Everyone ({contacts.length})
                </button>
                {contacts.map((c, i) => (
                  <button key={i} className="btn btn-sm"
                    onClick={() => toggleRecipient(i)}
                    style={{ fontSize: 11,
                      background: recipientIds.includes(i) ? 'var(--bg2)' : 'transparent',
                      fontWeight: recipientIds.includes(i) ? 600 : 400 }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
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

          {/* Send now */}
          <button className="btn btn-primary btn-full" onClick={() => send()}
            disabled={sending || !message.trim()}>
            {sending ? 'Sending…' : `📢 Send now${allSelected ? ` to all (${contacts.length})` : ` to ${recipientIds.length}`}`}
          </button>

          {/* Result */}
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
