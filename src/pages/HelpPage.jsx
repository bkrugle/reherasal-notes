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
- Groups are useful for choruses, ensembles, departments

CHECK-IN:
- Check-in tab shows live check-in list with timestamps and missing/present split
- Permanent QR → Show QR → Print Sign to print a sign for your stage door
- Students/cast scan QR with phone camera — no app download needed
- Show Day tab also has a check-in link and QR for show-day use
- Manual check-in available for directors/staff

NOTES (Log Note tab):
- Log notes with category, priority, cast tags, scene tags
- Use #hashtags for departments (e.g. #lights, #sound, #blocking)
- Use @ to tag cast members
- Priority levels: high, med, low
- Review tab shows all notes with filters
- Notes can be resolved, pinned, or sent to cast via Send tab

SHOW DAY (Show tab → Show Day):
- Activates automatically on show dates
- Curtain time countdown with auto-alerts at 60, 30, and 15 minutes before curtain
- Alert Staff / Alert Cast / Alert All buttons send push notifications via ntfy
- Custom Alert panel for sending custom messages to staff, cast, or all
- Show clock tracks Act 1, Intermission, Act 2 with live elapsed time
- Run History shows all performances' times side by side

SM DASHBOARD (Show tab → SM Dashboard):
- Available to Stage Manager, Asst. SM, Director, Asst. Director roles
- Pre-show: attendance summary + open notes from previous nights
- During show: live clock with Hold/Resume button for unexpected stops, note logging panel, open notes panel
- Post-show: run times summary, 30-minute countdown to auto-send show report email, closing notes
- Auto-switches from Show Day tab 5 seconds after Act 1 starts

SHOW CLOCK:
- SM starts Act 1, calls Intermission, calls Act 2, ends show
- Hold/Resume button pauses the clock (useful for power outages, emergencies)
- Clock syncs across all devices in real time
- Only the SM who starts the clock controls it (others see it locked)
- ✏ Enter times button lets anyone with access manually enter times

ALERTS & NOTIFICATIONS:
- Uses ntfy.sh for push notifications (free, no app required if using browser)
- Three targets: Staff (team members), Cast (phone/SMS), All (both)
- Auto-alerts fire automatically before curtain
- Custom alerts can be scheduled for a specific time
- Director ntfy topic set in Settings → Team

SHOW REPORT EMAIL:
- Fires automatically 30 minutes after End Show is clicked
- Goes to SM and Director email addresses
- Contains: run times, attendance, tonight's notes, open notes from previous nights
- Can also be sent manually from SM Dashboard post-show view
- reportFired is saved to the sheet so duplicate emails don't send across devices

PRODUCTION CLOSED SCREEN:
- Appears automatically after show dates have passed
- Shows: notes summary by category and department, full run history with averages, closeout message tools
- Confetti blast on login for 5 days after close 🎉
- Admin can manually close/reopen a production
- Send closeout email to staff or alerts to cast from this screen

SETUP (Settings):
- Details: production title, show dates, director info, curtain times
- Characters: cast/ensemble members (see Cast section above)
- Team: add staff members with roles, ntfy topics, phone numbers
- Scenes: add scenes for note tagging
- Show Dates: set which dates are show dates (activates Show Day mode)

MULTIPLE PRODUCTIONS:
- Each production is completely separate with its own code
- Log out and create a new production for each concert/show
- Switch between productions by logging in with different codes

ROLES:
- admin: full access, can edit settings
- member: standard access
- Stage Manager: controls show clock, sees SM Dashboard
- Director / Asst. Director: sees SM Dashboard, can edit times
- Other staff roles (Sound, Lights, etc.) see relevant content

COMMON QUESTIONS:
Q: How do I add my chorus members?
A: Settings → Characters → use the CSV upload (download the template first) or type names manually

Q: How do I print the check-in sign?
A: Check-in → Permanent QR → Show QR → Print Sign

Q: The clock won't start / I can't control the clock
A: Only the Stage Manager role can start the clock. Once started, it's locked to that person. Anyone with access can use ✏ Enter times to manually enter show times.

Q: I'm not getting push notifications
A: Make sure your ntfy topic is set in Settings → Team. Install the ntfy app on your phone or visit ntfy.sh in your browser and subscribe to your topic.

Q: How do I set up a second concert?
A: Log out → ovature.app → "Starting a new production? Create one" — give it a new name and you'll get a fresh production code.

Q: The run history isn't showing
A: It may take a few seconds to load from the server on first visit. Try refreshing or switching to another show date and back.

WHAT YOU DON'T KNOW:
- You don't have access to any specific user's production data
- You can't make changes to the app on the user's behalf
- For billing or account issues, direct users to Brian at vhsdrama.org

Always be helpful, specific, and encouraging. If you're not sure about something, say so honestly rather than guessing. You're here to make theater people's lives easier. 🎭`

const SUGGESTED_QUESTIONS = [
  'How do I add my cast members?',
  'How do I print the check-in QR code?',
  'How does the show clock work?',
  'Can I use Ovature for a concert?',
  'How do I set up multiple productions?',
  'What is the SM Dashboard?',
]

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
          animation: 'bounce 1.2s infinite',
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </div>
  )
}

export default function HelpPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm Ova, your Ovature assistant 🎭 I can help you get started, walk you through any feature, or answer questions about running your production. What can I help you with?"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')
    setError(null)

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
      setError('Connection error — please try again.')
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const showSuggestions = messages.length === 1

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg { animation: fadeUp 0.25s ease; }
        .suggestion-btn:hover { background: rgba(167,139,250,0.15) !important; border-color: rgba(167,139,250,0.4) !important; }
        .send-btn:hover:not(:disabled) { background: #7c3aed !important; }
        textarea:focus { outline: none; border-color: rgba(167,139,250,0.5) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #1a365d, #2d5a8e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 2px 12px rgba(26,54,93,0.5)'
          }}>🎭</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1 }}>Ovature</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Help Center</div>
          </div>
        </a>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Ova is online</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, width: '100%', margin: '0 auto' }}>

        {messages.map((msg, i) => (
          <div key={i} className="msg" style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-end', gap: 10
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #1a365d, #2d5a8e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16
              }}>🎭</div>
            )}
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #1a365d, #2563eb)'
                : 'rgba(255,255,255,0.06)',
              border: msg.role === 'user' ? 'none' : '0.5px solid rgba(255,255,255,0.1)',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#fff',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg" style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #1a365d, #2d5a8e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
            }}>🎭</div>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '18px 18px 18px 4px',
            }}>
              <TypingIndicator />
            </div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#fca5a5', padding: '8px 16px',
            background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '0.5px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Suggested questions */}
        {showSuggestions && !loading && (
          <div className="msg" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 42 }}>
            {SUGGESTED_QUESTIONS.map(q => (
              <button key={q} className="suggestion-btn" onClick={() => send(q)}
                style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  background: 'rgba(167,139,250,0.08)', color: 'rgba(255,255,255,0.7)',
                  border: '0.5px solid rgba(167,139,250,0.2)', transition: 'all 0.15s',
                  fontFamily: 'inherit'
                }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px 24px',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me anything about Ovature…"
            rows={1}
            disabled={loading}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 14, fontSize: 14,
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              color: '#fff', resize: 'none', lineHeight: 1.5,
              fontFamily: 'inherit', transition: 'border-color 0.15s',
              maxHeight: 120, overflowY: 'auto',
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: input.trim() && !loading ? '#5b21b6' : 'rgba(255,255,255,0.08)',
              color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}>
            ↑
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
          Ova can make mistakes. For urgent show day issues, contact your director directly.
        </p>
      </div>
    </div>
  )
}
