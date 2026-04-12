import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import LogTab from '../components/LogTab'
import ReviewTab from '../components/ReviewTab'
import ByCastTab from '../components/ByCastTab'
import SendTab from '../components/SendTab'
import MeetingMode from '../components/MeetingMode'
import TrendsTab from '../components/TrendsTab'
import AttendanceTab from '../components/AttendanceTab'
import ShowDayTab from '../components/ShowDayTab'
import ReportTab from '../components/ReportTab'
import SceneTimer from '../components/SceneTimer'
import { castNameList, normalizeCast } from '../lib/castUtils'
import CalendarTab from '../components/CalendarTab'
import DocumentsTab from '../components/DocumentsTab'
import Dashboard from '../components/Dashboard'
import AuditionsTab from '../components/AuditionsTab'
import CastDirectory from '../components/CastDirectory'
import WrapUp from '../components/WrapUp'

const TABS = ['Home', 'Log', 'Review', 'By cast', 'Calendar', 'Documents', 'Trends', 'Attendance', 'Report', 'Send', 'Auditions', 'Show Day']

function ShowCountdown({ showDates }) {
  if (!showDates) return null
  const match = showDates.match(/(\w+\s+\d+),?\s*(\d{4})?/)
  if (!match) return null
  try {
    const year = match[2] || new Date().getFullYear()
    const showDate = new Date(match[1] + ' ' + year)
    if (isNaN(showDate)) return null
    const today = new Date(); today.setHours(0,0,0,0); showDate.setHours(0,0,0,0)
    const diff = Math.round((showDate - today) / 86400000)
    if (diff < 0 || diff > 365) return null
    const color = diff <= 3 ? 'var(--red-text)' : diff <= 7 ? 'var(--amber-text)' : 'var(--text2)'
    const bg = diff <= 3 ? 'var(--red-bg)' : diff <= 7 ? 'var(--amber-bg)' : 'var(--bg2)'
    return (
      <div style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: bg, color, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {diff === 0 ? 'Opening night!' : diff === 1 ? 'Opens tomorrow!' : `${diff} days to opening`}
      </div>
    )
  } catch { return null }
}


/**
 * Parse show dates string and check if today falls within the range.
 * Handles formats like:
 *   "April 16-19, 2026"
 *   "April 16 - 19, 2026"
 *   "April 16 - May 2, 2026"
 *   "May 1-4, 2026"
 *   "April 16, 2026"
 */
function isWithinShowDates(showDates) {
  if (!showDates) return false
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const str = showDates.trim()

    // Try to extract year
    const yearMatch = str.match(/\b(20\d{2})\b/)
    const year = yearMatch ? parseInt(yearMatch[1]) : today.getFullYear()

    // Match: "Month D1 - D2, Year" or "Month D1-D2, Year"
    const sameMonthRange = str.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*(\d+)/)
    if (sameMonthRange) {
      const [, month, d1, d2] = sameMonthRange
      const start = new Date(`${month} ${d1}, ${year}`)
      const end = new Date(`${month} ${d2}, ${year}`)
      start.setHours(0,0,0,0); end.setHours(0,0,0,0)
      if (!isNaN(start) && !isNaN(end)) return today >= start && today <= end
    }

    // Match: "Month1 D1 - Month2 D2, Year"
    const crossMonthRange = str.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*([A-Za-z]+)\s+(\d+)/)
    if (crossMonthRange) {
      const [, m1, d1, m2, d2] = crossMonthRange
      const start = new Date(`${m1} ${d1}, ${year}`)
      const end = new Date(`${m2} ${d2}, ${year}`)
      start.setHours(0,0,0,0); end.setHours(0,0,0,0)
      if (!isNaN(start) && !isNaN(end)) return today >= start && today <= end
    }

    // Single date: "April 16, 2026"
    const single = new Date(str)
    if (!isNaN(single)) {
      single.setHours(0,0,0,0)
      return today.getTime() === single.getTime()
    }
  } catch (e) { console.warn('showDates parse failed:', e.message) }
  return false
}

export default function ProductionApp() {
  const { session, logout } = useSession()
  const navigate = useNavigate()
  const tabKey = 'rn_tab_' + (session?.sheetId || 'default')
  const [activeTab, setActiveTab] = useState(() => {
    try { return parseInt(sessionStorage.getItem(tabKey) || '0', 10) } catch { return 0 }
  })

  function setTab(idx) {
    setActiveTab(idx)
    try { sessionStorage.setItem(tabKey, String(idx)) } catch {}
  }
  const [production, setProduction] = useState(null)
  const [notes, setNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [error, setError] = useState('')
  const [meetingMode, setMeetingMode] = useState(false)
  const [showSceneTimer, setShowSceneTimer] = useState(false)
  const [wrapUp, setWrapUp] = useState(false)
  const [calendarEvents, setCalendarEvents] = useState([])
  const showDayKey = 'rn_showday_' + (session?.sheetId || 'default')
  const [showDayMode, setShowDayMode] = useState(() => {
    try { return localStorage.getItem(showDayKey) === 'true' } catch { return false }
  })

  // Auto-activate Show Day mode when today is a show date
  useEffect(() => {
    if (!production?.config?.showDates) return
    const isShowDay = isWithinShowDates(production.config.showDates)
    if (isShowDay && !showDayMode) {
      setShowDayMode(true)
      try { localStorage.setItem(showDayKey, 'true') } catch {}
      setTab(11)
    }
  }, [production])

  function toggleShowDayMode() {
    const next = !showDayMode
    setShowDayMode(next)
    try { localStorage.setItem(showDayKey, String(next)) } catch {}
    if (next) setTab(11)
  }

  const [swRunning, setSwRunning] = useState(false)
  const [swElapsed, setSwElapsed] = useState(0)
  const [swStart, setSwStart] = useState(0)
  const [swDisplay, setSwDisplay] = useState('0:00')

  useEffect(() => { loadProduction(); loadNotes() }, [])

  useEffect(() => {
    let interval
    if (swRunning) {
      interval = setInterval(() => {
        const e = Date.now() - swStart
        const m = Math.floor(e / 60000), s = Math.floor((e % 60000) / 1000)
        setSwDisplay(m + ':' + (s < 10 ? '0' : '') + s)
        setSwElapsed(e)
      }, 500)
    }
    return () => clearInterval(interval)
  }, [swRunning, swStart])

  async function loadProduction() {
    try {
      const data = await api.getProduction(session.sheetId)
      setProduction(data)
      // Load calendar events if configured
      const calId = data?.config?.calendarId
      if (calId) {
        api.getCalendar(calId, 2).then(d => setCalendarEvents(d.events || [])).catch(() => {})
      }
    } catch (e) { setError('Failed to load production config') }
  }

  async function loadNotes() {
    setLoadingNotes(true)
    try { const data = await api.getNotes(session.sheetId); setNotes(data.notes || []) }
    catch (e) { setError('Failed to load notes') }
    finally { setLoadingNotes(false) }
  }

  function swToggle() {
    if (!swRunning) { setSwStart(Date.now() - swElapsed); setSwRunning(true) }
    else setSwRunning(false)
  }
  function swReset() { setSwRunning(false); setSwElapsed(0); setSwDisplay('0:00') }
  function onNoteAdded(note) { setNotes(prev => [note, ...prev]) }
  function onNoteUpdated(updated) { setNotes(prev => prev.map(n => n.id === updated.id ? updated : n)) }
  function onNoteDeleted(id) { setNotes(prev => prev.filter(n => n.id !== id)) }

  function onLogForDate(date, scene) {
    // Switch to Log tab and pre-fill date/scene
    setActiveTab(0)
    // Store in sessionStorage for LogTab to pick up
    sessionStorage.setItem('rn_prefill', JSON.stringify({ date, scene: scene || '' }))
  }

  const scenes = production?.config?.scenes || []
  const rawCharacters = production?.config?.characters || []
  const characters = normalizeCast(rawCharacters)
  const characterNames = castNameList(characters)
  const staff = production?.config?.staff || []
  const showDates = production?.config?.showDates || ''
  const calendarId = production?.config?.calendarId || ''
  const attachFolderId = production?.config?.attachFolderId || ''
  const docsFolderId = production?.config?.docsFolderId || ''
  const useAuditions = production?.config?.useAuditions === 'true' || production?.config?.useAuditions === true
  const title = session?.title || production?.config?.title || 'Production'
  const openNotes = notes.filter(n => !n.resolved)
  const tabProps = { notes, sheetId: session.sheetId, scenes, characters, staff, onNoteUpdated, onNoteDeleted }

  if (wrapUp) {
    return <WrapUp notes={notes} characters={characters} production={production}
      session={session} sheetId={session.sheetId}
      onUpdated={onNoteUpdated} onClose={() => setWrapUp(false)} />
  }

  if (meetingMode) {
    return <MeetingMode notes={notes} sheetId={session.sheetId} onUpdated={onNoteUpdated} onClose={() => setMeetingMode(false)} />
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', padding: '0 1rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="topbar-inner" style={{ maxWidth: 880, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🎭</span>
            <div style={{ minWidth: 0 }}>
              <span className="topbar-title" style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{title}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{session.productionCode}</span>
            </div>
            <ShowCountdown showDates={showDates} />
          </div>
          <div className="topbar-controls" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* Stopwatch */}
            <div className="stopwatch-wrap" style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 8px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 500, minWidth: 44, color: swRunning ? '#e24b4a' : 'var(--text)' }}>{swDisplay}</span>
              <button className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 12 }} onClick={swToggle}>
                {swRunning ? '⏸' : swElapsed > 0 ? '▶' : '▶'}
              </button>
              <button className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 12 }} onClick={swReset}>↺</button>
            </div>
            <button className="btn btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setShowSceneTimer(t => !t)}>
              ⏱
            </button>
            {openNotes.length > 0 && (
              <button className="btn btn-sm" onClick={() => setMeetingMode(true)}
                style={{ background: 'var(--purple-bg)', color: 'var(--purple-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 12, padding: '4px 8px' }}>
                📋 {openNotes.length}
              </button>
            )}
            <button className="btn btn-sm" style={{ fontSize: 12, padding: '4px 8px', background: 'var(--amber-bg)', color: 'var(--amber-text)', borderColor: 'transparent', fontWeight: 500 }}
              onClick={() => setWrapUp(true)}>
              Wrap up
            </button>
            {session.role === 'admin' && (
              <button className="btn btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => navigate('/setup')}>⚙️</button>
            )}
            <button className="btn btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { logout(); navigate('/') }}>
              {session.name ? session.name.split(' ')[0] : 'Sign out'}
            </button>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingTop: '1.25rem' }}>
        {error && <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>{error}</p>}

        {showSceneTimer && <SceneTimer scenes={scenes} />}

        <div className="tabs tabs-desktop-only">
          {TABS.map((t, i) => (
            <button key={t} className={`tab-btn ${activeTab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>

        {activeTab === 0 && <Dashboard notes={notes} production={production} session={session} calendarEvents={calendarEvents} onNavigate={setTab} onLogForDate={onLogForDate} openNotes={openNotes} />}
        {activeTab === 1 && <LogTab sheetId={session.sheetId} scenes={scenes} characters={[...characterNames, ...staff]} swDisplay={swDisplay} swRunning={swRunning} createdBy={session.name || session.role} onNoteAdded={onNoteAdded} attachFolderId={attachFolderId} />}
        {activeTab === 2 && <ReviewTab {...tabProps} loading={loadingNotes} onRefresh={loadNotes} />}
        {activeTab === 3 && <ByCastTab {...tabProps} loading={loadingNotes} />}
        {activeTab === 4 && <CalendarTab calendarId={calendarId} scenes={scenes} notes={notes} onLogForDate={onLogForDate} />}
        {activeTab === 5 && <div><DocumentsTab docsFolderId={docsFolderId} attachFolderId={attachFolderId} isAdmin={session.role === 'admin'} /><div style={{marginTop:'1rem'}}><CastDirectory sheetId={session.sheetId} production={production} session={session} /></div></div>}
        {activeTab === 6 && <TrendsTab notes={notes} />}
        {activeTab === 7 && <AttendanceTab characters={characters} notes={notes} sheetId={session.sheetId} />}
        {activeTab === 8 && <ReportTab notes={notes} production={production} sheetId={session.sheetId} session={session} />}
        {activeTab === 9 && <SendTab notes={notes} characters={characters} characterNames={characterNames} sheetId={session.sheetId} production={production} session={session} />}
        {activeTab === 10 && useAuditions && <AuditionsTab sheetId={session.sheetId} productionCode={session.productionCode} session={session} production={production} onCastAssigned={loadProduction} />}
        {activeTab === 11 && <ShowDayTab sheetId={session.sheetId} productionCode={session.productionCode} production={production} session={session} showDayMode={showDayMode} />}
      </div>
      {/* Bottom nav — mobile only */}
      <nav className="bottom-nav" style={showDayMode ? { background: 'var(--bg)', borderTop: '2px solid var(--amber-text)' } : {}}>
        {showDayMode ? (
          // ── SHOW DAY MODE nav ──────────────────────────────────────
          <>
            <button className={`bottom-nav-btn ${activeTab === 0 ? 'active' : ''}`} onClick={() => setTab(0)}>
              <span style={{ fontSize: 18 }}>🏠</span>
              <span>Home</span>
            </button>
            <button className={`bottom-nav-btn ${activeTab === 1 ? 'active' : ''}`} onClick={() => setTab(1)}>
              <span style={{ fontSize: 18 }}>✏️</span>
              <span>Log</span>
            </button>
            {/* Big Show Day button */}
            <button
              onClick={() => setTab(11)}
              style={{
                flex: '0 0 auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '4px 0',
                background: activeTab === 11 ? 'var(--amber-text)' : 'var(--bg2)',
                border: '2px solid var(--amber-text)',
                borderRadius: 'var(--radius)',
                color: activeTab === 11 ? 'var(--bg)' : 'var(--amber-text)',
                fontWeight: 700, cursor: 'pointer',
                minWidth: 80, margin: '4px 4px',
                fontSize: 11,
              }}>
              <span style={{ fontSize: 22 }}>🎬</span>
              <span>SHOW DAY</span>
            </button>
            <button className={`bottom-nav-btn ${activeTab === 9 ? 'active' : ''}`} onClick={() => setTab(9)}>
              <span style={{ fontSize: 18 }}>✉️</span>
              <span>Send</span>
            </button>
            <button
              onClick={toggleShowDayMode}
              className="bottom-nav-btn"
              style={{ color: 'var(--text3)' }}>
              <span style={{ fontSize: 18 }}>🔄</span>
              <span>Rehearsal</span>
            </button>
          </>
        ) : (
          // ── REHEARSAL MODE nav ─────────────────────────────────────
          <>
            {[
              { icon: '🏠', label: 'Home',     idx: 0 },
              { icon: '✏️', label: 'Log',      idx: 1 },
              { icon: '📋', label: 'Review',   idx: 2 },
              { icon: '👤', label: 'Cast',     idx: 3 },
              ...(useAuditions
                ? [{ icon: '🎭', label: 'Auditions', idx: 10 }]
                : [{ icon: '✉️', label: 'Send', idx: 9 }]
              ),
            ].map(({ icon, label, idx }) => (
              <button key={label} className={`bottom-nav-btn ${activeTab === idx ? 'active' : ''}`}
                onClick={() => setTab(idx)}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
            {/* Show Day button — smaller in rehearsal mode */}
            <button
              onClick={toggleShowDayMode}
              className={`bottom-nav-btn ${activeTab === 11 ? 'active' : ''}`}
              style={{ color: 'var(--amber-text)' }}>
              <span style={{ fontSize: 20 }}>🎬</span>
              <span>Show Day</span>
            </button>
          </>
        )}
      </nav>
    </div>
  )
}
