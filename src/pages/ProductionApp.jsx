import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
import AppShell from '../components/AppShell'
import CheckinTab from '../components/CheckinTab'
import ReportTab from '../components/ReportTab'
import SceneTimer from '../components/SceneTimer'
import { castNameList, normalizeCast } from '../lib/castUtils'
import CalendarTab from '../components/CalendarTab'
import DocumentsTab from '../components/DocumentsTab'
import Dashboard from '../components/Dashboard'
import AuditionsTab from '../components/AuditionsTab'
import CastDirectory from '../components/CastDirectory'
import WrapUp from '../components/WrapUp'

const TABS = ['Home', 'Log', 'Review', 'By cast', 'Calendar', 'Documents', 'Trends', 'Attendance', 'Report', 'Send', 'Auditions', 'Show Day', 'Check-in']

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
    setShowMoreMenu(false)
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
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const showDayKey = 'rn_showday_' + (session?.sheetId || 'default')
  const [showDayMode, setShowDayMode] = useState(() => {
    try { return localStorage.getItem(showDayKey) === 'true' } catch { return false }
  })

  // Handle ?showday=1 URL param (from Setup page launch button)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('showday') === '1') {
      setShowDayMode(true)
      try { localStorage.setItem(showDayKey, 'true') } catch {}
      setTab(11)
      navigate('/production', { replace: true })
    }
  }, [location.search])

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

  const isShowDay = isWithinShowDates(production?.config?.showDates || '')

  function activateShowDay() {
    setShowDayMode(true)
    try { localStorage.setItem(showDayKey, 'true') } catch {}
    setTab(11)
  }

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
      // Apply accent color from production config
      if (data?.config?.accentColor) {
        document.documentElement.style.setProperty('--accent', data.config.accentColor)
        document.documentElement.style.setProperty('--accent-bg', data.config.accentBg || data.config.accentColor + '20')
      }
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

  const SIDEBAR_TABS = [
    { section: 'Rehearsal', items: [
      { label: 'Home', idx: 0, icon: 'home' },
      { label: 'Log note', idx: 1, icon: 'edit' },
      { label: 'Review', idx: 2, icon: 'clipboard' },
      { label: 'By cast', idx: 3, icon: 'users' },
      { label: 'Calendar', idx: 4, icon: 'calendar' },
    ]},
    { section: 'Communications', items: [
      { label: 'Send notes', idx: 9, icon: 'send' },
      { label: 'Report', idx: 8, icon: 'file' },
      { label: 'Documents', idx: 5, icon: 'folder' },
    ]},
    { section: 'Analytics', items: [
      { label: 'Trends', idx: 6, icon: 'trending' },
      { label: 'Attendance', idx: 7, icon: 'check-square' },
      { label: 'Check-in', idx: 12, icon: 'clock' },
    ]},
    { section: 'Show', items: [
      ...(useAuditions ? [{ label: 'Auditions', idx: 10, icon: 'star' }] : []),
    ]},
  ]

  const SidebarIcon = ({ name }) => {
    const icons = {
      home: <path d="M3 12L12 3l9 9M5 10v10h5v-6h4v6h5V10"/>,
      edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
      clipboard: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></>,
      users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,
      calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
      send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
      file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
      folder: <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>,
      trending: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
      'check-square': <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,
      clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
      star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
      video: <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>,
    }
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
        {icons[name]}
      </svg>
    )
  }

  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{TABS[activeTab] || 'Home'}</span>
        <ShowCountdown showDates={showDates} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 10px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 500, minWidth: 44, color: swRunning ? 'var(--red-text)' : 'var(--text)' }}>{swDisplay}</span>
          <button className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 12 }} onClick={swToggle}>{swRunning ? '⏸' : '▶'}</button>
          {swElapsed > 0 && <button className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 12 }} onClick={swReset}>↺</button>}
        </div>
        {openNotes.length > 0 && (
          <button className="btn btn-sm" onClick={() => setMeetingMode(true)}
            style={{ background: 'var(--purple-bg)', color: 'var(--purple-text)', borderColor: 'transparent', fontWeight: 500 }}>
            📋 {openNotes.length}
          </button>
        )}
        <button className="btn btn-sm" style={{ padding: '5px 8px', fontSize: 13 }}
          onClick={() => setShowSceneTimer(t => !t)} title="Scene timer">⏱</button>
        <button className="btn btn-sm" style={{ background: 'var(--amber-bg)', color: 'var(--amber-text)', borderColor: 'transparent', fontWeight: 500 }}
          onClick={() => setWrapUp(true)}>Wrap up</button>
      </div>
    </div>
  )

  return (
    <>
      <AppShell
        title={title}
        productionCode={session.productionCode}
        activeTab={activeTab}
        onTabChange={setTab}
        showDayMode={showDayMode}
        openNotesCount={openNotes.length}
        useAuditions={useAuditions}
        onShowDay={activateShowDay}
        isShowDay={isShowDay}
        topBarContent={topBar}
      >
        <div className="page" style={{ paddingTop: '1.25rem' }}>
          {error && <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>{error}</p>}
          {showSceneTimer && <SceneTimer scenes={scenes} />}
          {activeTab === 0 && <Dashboard notes={notes} production={production} session={session} calendarEvents={calendarEvents} onNavigate={setTab} onLogForDate={onLogForDate} openNotes={openNotes} />}
          {activeTab === 1 && <LogTab sheetId={session.sheetId} scenes={scenes} characters={[...characterNames, ...staff]} swDisplay={swDisplay} swRunning={swRunning} createdBy={session.name || session.role} onNoteAdded={onNoteAdded} attachFolderId={attachFolderId} />}
          {activeTab === 2 && <ReviewTab {...tabProps} loading={loadingNotes} onRefresh={loadNotes} />}
          {activeTab === 3 && <ByCastTab {...tabProps} loading={loadingNotes} />}
          {activeTab === 4 && <CalendarTab calendarId={calendarId} scenes={scenes} notes={notes} onLogForDate={onLogForDate} />}
          {activeTab === 5 && <div><DocumentsTab docsFolderId={docsFolderId} attachFolderId={attachFolderId} isAdmin={session.role === 'admin'} /><div style={{marginTop:'1rem'}}><CastDirectory sheetId={session.sheetId} production={production} session={session} /></div></div>}
          {activeTab === 6 && <TrendsTab notes={notes} />}
          {activeTab === 7 && <AttendanceTab characters={characters} notes={notes} sheetId={session.sheetId} production={production} productionCode={session.productionCode} />}
          {activeTab === 8 && <ReportTab notes={notes} production={production} sheetId={session.sheetId} session={session} />}
          {activeTab === 9 && <SendTab notes={notes} characters={characters} characterNames={characterNames} sheetId={session.sheetId} production={production} session={session} />}
          {activeTab === 10 && useAuditions && <AuditionsTab sheetId={session.sheetId} productionCode={session.productionCode} session={session} production={production} onCastAssigned={loadProduction} />}
          {activeTab === 11 && <ShowDayTab sheetId={session.sheetId} productionCode={session.productionCode} production={production} session={session} showDayMode={showDayMode} onGoToCheckin={() => setTab(12)} />}
          {activeTab === 12 && <CheckinTab sheetId={session.sheetId} productionCode={session.productionCode} production={production} session={session} />}
        </div>
      </AppShell>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" style={showDayMode ? { borderTop: '2px solid var(--accent)' } : {}}>
        {showDayMode ? (
          <>
            <button className={`bottom-nav-btn ${activeTab === 0 ? 'active' : ''}`} onClick={() => setTab(0)}>
              <span style={{ fontSize: 20 }}>🏠</span><span>Home</span>
            </button>
            <button className={`bottom-nav-btn ${activeTab === 1 ? 'active' : ''}`} onClick={() => setTab(1)}>
              <span style={{ fontSize: 20 }}>✏️</span><span>Log</span>
            </button>
            <button className="show-day-nav-btn" onClick={() => setTab(11)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              Show day
            </button>
            <button className={`bottom-nav-btn ${activeTab === 9 ? 'active' : ''}`} onClick={() => setTab(9)}>
              <span style={{ fontSize: 20 }}>✉️</span><span>Send</span>
            </button>
            <button className="bottom-nav-btn" onClick={toggleShowDayMode} style={{ color: 'var(--text3)' }}>
              <span style={{ fontSize: 20 }}>🔄</span><span>Exit</span>
            </button>
          </>
        ) : (
          <>
            <button className={`bottom-nav-btn ${activeTab === 0 ? 'active' : ''}`} onClick={() => setTab(0)}>
              <span style={{ fontSize: 20 }}>🏠</span><span>Home</span>
            </button>
            <button className={`bottom-nav-btn ${activeTab === 1 ? 'active' : ''}`} onClick={() => setTab(1)}>
              <span style={{ fontSize: 20 }}>✏️</span><span>Log</span>
            </button>
            <button className={`bottom-nav-btn ${activeTab === 2 ? 'active' : ''}`} onClick={() => setTab(2)}>
              <span style={{ fontSize: 20 }}>📋</span><span>Review</span>
            </button>
            {isShowDay && (
              <button className={`bottom-nav-btn ${activeTab === 11 ? 'active' : ''}`} onClick={activateShowDay}>
                <span style={{ fontSize: 20 }}>🎬</span><span>Show Day</span>
              </button>
            )}
            <button className={`bottom-nav-btn ${[3,4,5,6,7,8,9,10,12].includes(activeTab) ? 'active' : ''}`}
              onClick={() => setShowMoreMenu(m => !m)}>
              <span style={{ fontSize: 20 }}>⋯</span><span>More</span>
            </button>
          </>
        )}
      </nav>

      {showMoreMenu && !showDayMode && (
        <div style={{
          position: 'fixed', bottom: 60, left: 0, right: 0, zIndex: 200,
          background: 'var(--bg)', borderTop: '0.5px solid var(--border)',
          padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8
        }} onClick={() => setShowMoreMenu(false)}>
          {[
            { icon: '👤', label: 'Cast', idx: 3 },
            { icon: '📅', label: 'Calendar', idx: 4 },
            { icon: '📁', label: 'Docs', idx: 5 },
            { icon: '📈', label: 'Trends', idx: 6 },
            { icon: '✅', label: 'Attendance', idx: 7 },
            { icon: '📄', label: 'Report', idx: 8 },
            { icon: '✉️', label: 'Send', idx: 9 },
            ...(useAuditions ? [{ icon: '🎭', label: 'Auditions', idx: 10 }] : []),
            { icon: '✅', label: 'Check-in', idx: 12 },
          ].map(({ icon, label, idx }) => (
            <button key={label}
              className={`bottom-nav-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setTab(idx)}
              style={{ flexDirection: 'column', padding: '8px 4px', borderRadius: 'var(--radius)', background: activeTab === idx ? 'var(--bg2)' : 'transparent' }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: 10 }}>{label}</span>
            </button>
          ))}
        </div>
      )}
      {showMoreMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowMoreMenu(false)} />}
    </>
  )
}
