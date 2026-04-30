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
import ShowDayTab from "../components/ShowDayTab"
import SMDashboard from "../components/SMDashboard"
import AppShell from '../components/AppShell'
import CheckinTab from '../components/CheckinTab'
import MicTrackerTab from '../components/MicTrackerTab'
import PreShowChecklist from '../components/PreShowChecklist'
import IntermissionDashboard from '../components/IntermissionDashboard'
import ReportTab from '../components/ReportTab'
import SceneTimer from '../components/SceneTimer'
import { castNameList, normalizeCast, getNotesForUser, getVisibleNotesForUser } from "../lib/castUtils"
import { getTimelineRemote } from "../lib/showTimeline"
import CalendarTab from '../components/CalendarTab'
import DocumentsTab from '../components/DocumentsTab'
import Dashboard from '../components/Dashboard'
import AuditionsTab from '../components/AuditionsTab'
import CastDirectory from '../components/CastDirectory'
import WrapUp from '../components/WrapUp'
import LoginGreetingModal from '../components/LoginGreetingModal'
import ProductionClosed, { isAfterShowDates } from '../components/ProductionClosed'
import OvaWidget from '../components/OvaWidget'

const TABS = ['Home', 'Log', 'Review', 'By cast', 'Calendar', 'Documents', 'Trends', 'Attendance', 'Report', 'Send', 'Auditions', 'Show Day', 'Check-in', 'Mic Tracker', 'Pre-show', 'Intermission', 'SM Dashboard']

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

function isWithinShowDates(showDates) {
  if (!showDates) return false
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const str = showDates.trim()
    const yearMatch = str.match(/\b(20\d{2})\b/)
    const year = yearMatch ? parseInt(yearMatch[1]) : today.getFullYear()
    const sameMonthRange = str.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*(\d+)/)
    if (sameMonthRange) {
      const [, month, d1, d2] = sameMonthRange
      const start = new Date(`${month} ${d1}, ${year}`)
      const end = new Date(`${month} ${d2}, ${year}`)
      start.setHours(0,0,0,0); end.setHours(0,0,0,0)
      if (!isNaN(start) && !isNaN(end)) return today >= start && today <= end
    }
    const crossMonthRange = str.match(/([A-Za-z]+)\s+(\d+)\s*[-–]\s*([A-Za-z]+)\s+(\d+)/)
    if (crossMonthRange) {
      const [, m1, d1, m2, d2] = crossMonthRange
      const start = new Date(`${m1} ${d1}, ${year}`)
      const end = new Date(`${m2} ${d2}, ${year}`)
      start.setHours(0,0,0,0); end.setHours(0,0,0,0)
      if (!isNaN(start) && !isNaN(end)) return today >= start && today <= end
    }
    const single = new Date(str)
    if (!isNaN(single)) { single.setHours(0,0,0,0); return today.getTime() === single.getTime() }
  } catch (e) { console.warn('showDates parse failed:', e.message) }
  return false
}

function darkenColor(hex, amount = 30) {
  try {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    const d = (v) => Math.max(0, v - amount).toString(16).padStart(2,'0')
    return '#' + d(r) + d(g) + d(b)
  } catch { return '#0f2340' }
}

export function applyAccentColor(color, bg) {
  if (!color) return
  document.documentElement.style.setProperty('--accent', color)
  document.documentElement.style.setProperty('--accent-bg', bg || color + '20')
  document.documentElement.style.setProperty('--sidebar-bg', darkenColor(color, 40))
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
  const [showGreeting, setShowGreeting] = useState(false)
  const showDayKey = 'rn_showday_' + (session?.sheetId || 'default')
  const [showDayMode, setShowDayMode] = useState(() => {
    try { return localStorage.getItem(showDayKey) === 'true' } catch { return false }
  })

  useEffect(() => {
    if (loadingNotes) return
    if (!session?.name) return
    const myNotes = getNotesForUser(notes, session)
    if (myNotes.length > 0) setShowGreeting(true)
  }, [loadingNotes])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('showday') === '1') {
      setShowDayMode(true)
      try { localStorage.setItem(showDayKey, 'true') } catch {}
      setTab(11)
      navigate('/production', { replace: true })
    }
  }, [location.search])

  useEffect(() => {
    if (!production?.config?.showDates) return
    const isShowDay = isWithinShowDates(production.config.showDates)
    if (isShowDay) {
      setShowDayMode(true)
      try { localStorage.setItem(showDayKey, 'true') } catch {}
      const showTabs = [11, 12, 13, 14, 15, 16]
      if (!showTabs.includes(activeTab)) setTab(11)
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

  function handleLogout() {
    logout()
    navigate('/')
  }

  const [swRunning, setSwRunning] = useState(false)
  const [swElapsed, setSwElapsed] = useState(0)
  const [swStart, setSwStart] = useState(0)
  const [swDisplay, setSwDisplay] = useState('0:00')

  useEffect(() => { loadProduction(); loadNotes() }, [])

  // Auto-switch SM/Director to SM Dashboard when show starts
  useEffect(() => {
    const smRoles = ['Stage Manager', 'Asst. SM', 'Assistant SM', 'Director', 'Asst. Director', 'Assistant Director']
    if (!smRoles.includes(session?.staffRole) && session?.role !== 'admin') return
    let lastPhase = null
    let interval = null
    const today = new Date().toLocaleDateString('en-CA')

    async function checkPhase() {
      try {
        const { timeline } = await getTimelineRemote(session.sheetId, today)
        if (!timeline) return
        if (lastPhase === 'preshow' && timeline.phase === 'act1') {
          setTimeout(() => setTab(16), 5000)
        }
        lastPhase = timeline.phase
      } catch {}
    }

    // Run immediately on mount to set lastPhase, then start polling
    checkPhase().then(() => {
      interval = setInterval(checkPhase, 20000)
    })

    return () => clearInterval(interval)
  }, [session?.sheetId])

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
      if (data?.config?.accentColor) applyAccentColor(data.config.accentColor, data.config.accentBg)
      const calId = data?.config?.calendarId
      if (calId) api.getCalendar(calId, 2).then(d => setCalendarEvents(d.events || [])).catch(() => {})
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
    setActiveTab(0)
    sessionStorage.setItem('rn_prefill', JSON.stringify({ date, scene: scene || '' }))
  }

  const scenes = production?.config?.scenes || []
  const acts = production?.config?.acts || []
  const scenesStruct = production?.config?.scenes_struct || []
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
  const filteredNotes = getNotesForUser(notes, session)
  const reviewNotes = getVisibleNotesForUser(notes, session)
  const tabProps = { notes, sheetId: session.sheetId, scenes, scenesStruct, acts, characters, staff, onNoteUpdated, onNoteDeleted }

  const smRoles = ['Stage Manager', 'Asst. SM', 'Assistant SM', 'Director', 'Asst. Director', 'Assistant Director']
  const canSeeSMDashboard = smRoles.includes(session?.staffRole) || session?.role === 'admin'

  if (wrapUp) {
    return <WrapUp notes={notes} characters={characters} production={production}
      session={session} sheetId={session.sheetId}
      onUpdated={onNoteUpdated} onClose={() => setWrapUp(false)} />
  }

  if (meetingMode) {
    return <MeetingMode notes={notes} sheetId={session.sheetId} onUpdated={onNoteUpdated} onClose={() => setMeetingMode(false)} />
  }

  const [forceOpen, setForceOpen] = useState(false)

  // Show closed screen if production is manually closed OR show dates have passed
  const isClosed = !forceOpen && (production?.config?.productionClosed === 'true' ||
    (production?.config?.showDates && isAfterShowDates(production.config.showDates)))
  if (isClosed && production) {
    return <ProductionClosed
      production={production}
      session={session}
      notes={notes}
      sheetId={session.sheetId}
      onReopen={() => { setForceOpen(true); loadProduction() }}
    />
  }

  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {session?.platformAdmin && (
          <button className="btn btn-sm" onClick={() => { logout(); navigate('/platform') }}
            style={{ fontSize: 11, background: 'var(--purple-bg)', color: 'var(--purple-text)', borderColor: 'transparent' }}>
            ← Platform
          </button>
        )}
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
      {showGreeting && (
        <LoginGreetingModal
          session={session}
          notes={notes}
          onClose={() => setShowGreeting(false)}
          onReviewNotes={() => setTab(2)}
        />
      )}

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
          {activeTab === 1 && <LogTab sheetId={session.sheetId} scenes={scenes} scenesStruct={scenesStruct} acts={acts} characters={[...characterNames, ...staff]} swDisplay={swDisplay} swRunning={swRunning} createdBy={session.name || session.role} onNoteAdded={onNoteAdded} onNoteUpdated={onNoteUpdated} attachFolderId={attachFolderId} />}
          {activeTab === 2 && <ReviewTab {...tabProps} notes={reviewNotes} production={production} loading={loadingNotes} onRefresh={loadNotes} session={session} />}
          {activeTab === 3 && <ByCastTab {...tabProps} loading={loadingNotes} />}
          {activeTab === 4 && <CalendarTab calendarId={calendarId} scenes={scenes} notes={notes} onLogForDate={onLogForDate} />}
          {activeTab === 5 && <div><DocumentsTab docsFolderId={docsFolderId} attachFolderId={attachFolderId} isAdmin={session.role === 'admin'} /><div style={{marginTop:'1rem'}}><CastDirectory sheetId={session.sheetId} production={production} session={session} /></div></div>}
          {activeTab === 6 && <TrendsTab notes={notes} />}
          {activeTab === 7 && <AttendanceTab characters={characters} notes={notes} sheetId={session.sheetId} production={production} productionCode={session.productionCode} session={session} />}
          {activeTab === 8 && <ReportTab notes={notes} production={production} sheetId={session.sheetId} session={session} />}
          {activeTab === 9 && <SendTab notes={notes} characters={characters} characterNames={characterNames} sheetId={session.sheetId} production={production} session={session} />}
          {activeTab === 10 && useAuditions && <AuditionsTab sheetId={session.sheetId} productionCode={session.productionCode} session={session} production={production} onCastAssigned={loadProduction} />}
          {activeTab === 11 && <ShowDayTab sheetId={session.sheetId} productionCode={session.productionCode} production={production} session={session} showDayMode={showDayMode} onGoToCheckin={() => setTab(12)} />}
          {activeTab === 12 && <CheckinTab sheetId={session.sheetId} productionCode={session.productionCode} production={production} session={session} />}
          {activeTab === 13 && <MicTrackerTab characters={characters} production={production} sheetId={session.sheetId} />}
          {activeTab === 14 && <PreShowChecklist sheetId={session.sheetId} production={production} session={session} />}
          {activeTab === 15 && <IntermissionDashboard sheetId={session.sheetId} productionCode={session.productionCode} production={production} session={session} notes={notes} onLogNote={loadNotes} />}
          {activeTab === 16 && canSeeSMDashboard && <SMDashboard sheetId={session.sheetId} productionCode={session.productionCode} production={production} session={session} notes={notes} characters={characters} scenes={scenes} onNoteAdded={onNoteAdded} onNoteUpdated={onNoteUpdated} />}
        </div>
      </AppShell>

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
            <button className={`bottom-nav-btn ${[3,4,5,6,7,8,9,10,12,16].includes(activeTab) ? 'active' : ''}`}
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
            ...(canSeeSMDashboard ? [{ icon: '🎬', label: 'SM View', idx: 16 }] : []),
          ].map(({ icon, label, idx }) => (
            <button key={label}
              className={`bottom-nav-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setTab(idx)}
              style={{ flexDirection: 'column', padding: '8px 4px', borderRadius: 'var(--radius)', background: activeTab === idx ? 'var(--bg2)' : 'transparent' }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: 10 }}>{label}</span>
            </button>
          ))}
          <button className="bottom-nav-btn" onClick={handleLogout}
            style={{ flexDirection: 'column', padding: '8px 4px', borderRadius: 'var(--radius)', color: 'var(--red-text)' }}>
            <span style={{ fontSize: 22 }}>🚪</span>
            <span style={{ fontSize: 10 }}>Sign out</span>
          </button>
        </div>
      )}
      {showMoreMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowMoreMenu(false)} />}

      <OvaWidget hidden={showDayMode && [11, 12, 15, 16].includes(activeTab)} />
    </>
  )
}
