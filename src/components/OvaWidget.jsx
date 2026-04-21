import { useState, useRef, useEffect } from 'react'

const SYSTEM_PROMPT = `You are Ova, the friendly and knowledgeable assistant for Ovature — a theater and performance production management platform built for directors, stage managers, and educators.

Ovature lives at ovature.app and helps production teams manage notes, cast check-in, show day timing, alerts, and more.

YOUR TONE:
- Warm, practical, and encouraging — like a knowledgeable colleague, not a manual
- Use plain language. Avoid jargon unless the user uses it first.
- Keep answers focused and actionable. Don't over-explain.
- It's fine to be a little playful — this is theater after all 🎭

OVATURE FEATURES YOU KNOW DEEPLY:

GETTING STARTED:
- Go to ovature.app, enter your production code and PIN to log in
- New productions: click "Starting a new production? Create one" on the login screen
- Each production has its own code, cast list, and settings

NAVIGATION:
- Desktop: sidebar on the left with sections (Rehearsal, Communications, Analytics, Show)
- Mobile: bottom nav bar with Home, Log, Review, and a "More" menu
- Show Day mode activates automatically on show dates and adds show-specific tabs

CAST / CHARACTERS (Settings → Characters):
- Add cast members individually or via CSV upload
- CSV template columns: Character/Group Name, Cast Member Name, Group Members, Phone, Email
- For concerts/non-theater: just use Cast Member Name column — no character name needed
- Groups: put group name in Character/Group Name, pipe-separated members in Group Members (e.g. Emma|Taylor|Jordan)

CHECK-IN:
- Check-in tab shows live check-in list with timestamps and missing/present split
- Permanent QR → Show QR → Print Sign to print a sign for your stage door
- Students/cast scan QR with phone camera — no app download needed
- Manual check-in available for directors/staff

NOTES (Log Note tab):
- Log notes with category, priority, cast tags, scene tags
- Use #hashtags for departments (e.g. #lights, #sound, #blocking)
- Use @ to tag cast members
- Review tab shows all notes with filters
- Notes can be resolved, pinned, or sent to cast via Send tab

SHOW DAY (Show tab → Show Day):
- Activates automatically on show dates
- Curtain time countdown with auto-alerts at 60, 30, and 15 minutes before curtain
- Alert Staff / Alert Cast / Alert All buttons send push notifications
- Show clock tracks Act 1, Intermission, Act 2 with live elapsed time

SM DASHBOARD (Show tab → SM Dashboard):
- Available to Stage Manager, Asst. SM, Director, Asst. Director roles
- Pre-show: attendance summary + open notes from previous nights
- During show: live clock with Hold/Resume, note logging, open notes panel
- Post-show: run times, 30-min countdown to auto-send show report email

SHOW CLOCK:
- SM starts Act 1, calls Intermission, calls Act 2, ends show
- Hold/Resume button pauses the clock for unexpected stops
- Clock syncs across all devices in real time
- ✏ Enter times button for manual time entry

ALERTS:
- Three targets: Staff, Cast, All
- Auto-alerts fire before curtain automatically
- Custom alerts can be scheduled

SETUP (Settings):
- Details: production title, show dates, director info, curtain times
- Characters: cast/ensemble members
- Team: staff members with roles and ntfy topics
- Scenes: for note tagging

MULTIPLE PRODUCTIONS:
- Log out and create a new production for each concert/show
- Switch between productions by logging in with different codes

Always be helpful, specific, and encouraging. Keep answers concise — this is a floating chat widget, not a full help page. If they need more detail, suggest they visit ovature.app/help. 🎭`

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--text3)',
          animation: 'ova-bounce 1.2s infinite',
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </div>
  )
}

export default function OvaWidget({ hidden }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Ova 🎭 How can I help you with Ovature?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  async function send(text) {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/.netlify/functions/chatProxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await res.json()
      const reply = data.content?.find(b => b.type === 'text')?.text || 'Sorry, I had trouble with that. Try again?'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection issue — please try again.' }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (hidden) return null

  return (
    <>
      <style>{`
        @keyframes ova-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes ova-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ova-panel { animation: ova-slide-up 0.2s ease; }
        .ova-fab:hover { transform: scale(1.08) !important; }
        .ova-fab:active { transform: scale(0.96) !important; }
        .ova-send:hover:not(:disabled) { opacity: 0.85; }
      `}</style>

      {/* Chat panel */}
      {open && (
        <div className="ova-panel" style={{
          position: 'fixed',
          bottom: 76,
          right: 20,
          width: 340,
          maxWidth: 'calc(100vw - 40px)',
          height: 460,
          maxHeight: 'calc(100vh - 120px)',
          background: 'var(--bg)',
          border: '0.5px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9998,
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '12px 14px',
            borderBottom: '0.5px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg2)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #1a365d, #2d5a8e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
            }}>🎭</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ova</div>
              <div style={{ fontSize: 10, color: 'var(--green-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green-text)' }} />
                Online
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <a href="/help" target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'none', padding: '3px 8px', borderRadius: 6, background: 'var(--bg3)', border: '0.5px solid var(--border)' }}>
                Full help →
              </a>
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 7
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: 'linear-gradient(135deg, #1a365d, #2d5a8e)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
                  }}>🎭</div>
                )}
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg2)',
                  border: msg.role === 'user' ? 'none' : '0.5px solid var(--border)',
                  fontSize: 13, lineHeight: 1.5,
                  color: msg.role === 'user' ? 'var(--accent-text)' : 'var(--text)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: 'linear-gradient(135deg, #1a365d, #2d5a8e)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
                }}>🎭</div>
                <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: '14px 14px 14px 4px' }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Ova anything…"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13,
                background: 'var(--bg2)', border: '0.5px solid var(--border)',
                color: 'var(--text)', resize: 'none', lineHeight: 1.5,
                fontFamily: 'inherit', maxHeight: 80, overflowY: 'auto',
              }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
              }}
            />
            <button className="ova-send" onClick={() => send()} disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: 9, border: 'none', cursor: 'pointer',
                background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg3)',
                color: input.trim() && !loading ? 'var(--accent-text)' : 'var(--text3)',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
              }}>
              ↑
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button className="ova-fab" onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 20, right: 20,
          width: 48, height: 48, borderRadius: 14,
          background: open ? 'var(--bg2)' : 'linear-gradient(135deg, #1a365d, #2d5a8e)',
          border: open ? '0.5px solid var(--border)' : 'none',
          boxShadow: open ? 'none' : '0 4px 20px rgba(26,54,93,0.5)',
          color: '#fff', fontSize: open ? 22 : 20,
          cursor: 'pointer', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
        {open ? '×' : '🎭'}
      </button>
    </>
  )
}
