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
import ReportTab from '../components/ReportTab'
import SceneTimer from '../components/SceneTimer'
import CalendarTab from '../components/CalendarTab'
import DocumentsTab from '../components/DocumentsTab'

const TABS = ['Log', 'Review', 'By cast', 'Calendar', 'Documents', 'Trends', 'Attendance', 'Report', 'Send']

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

export default function ProductionApp() {
  const { session, logout } = useSession()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [production, setProduction] = useState(null)
  const [notes, setNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [error, setError] = useState('')
  const [meetingMode, setMeetingMode] = useState(false)
  const [showSceneTimer, setShowSceneTimer] = useState(false)

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
    try { const data = await api.getProduction(session.sheetId); setProduction(data) }
    catch (e) { setError('Failed to load production config') }
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
  const characters = production?.config?.characters || []
  const staff = production?.config?.staff || []
  const showDates = production?.config?.showDates || ''
  const calendarId = production?.config?.calendarId || ''
  const attachFolderId = production?.config?.attachFolderId || ''
  const docsFolderId = production?.config?.docsFolderId || ''
  const title = session?.title || production?.config?.title || 'Production'
  const openNotes = notes.filter(n => !n.resolved)
  const tabProps = { notes, sheetId: session.sheetId, scenes, characters, staff, onNoteUpdated, onNoteDeleted }

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
            <button key={t} className={`tab-btn ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>

        {activeTab === 0 && <LogTab sheetId={session.sheetId} scenes={scenes} characters={[...characters, ...staff]} swDisplay={swDisplay} swRunning={swRunning} createdBy={session.name || session.role} onNoteAdded={onNoteAdded} attachFolderId={attachFolderId} />}
        {activeTab === 1 && <ReviewTab {...tabProps} loading={loadingNotes} onRefresh={loadNotes} />}
        {activeTab === 2 && <ByCastTab {...tabProps} loading={loadingNotes} />}
        {activeTab === 3 && <CalendarTab calendarId={calendarId} scenes={scenes} notes={notes} onLogForDate={onLogForDate} />}
        {activeTab === 4 && <DocumentsTab docsFolderId={docsFolderId} isAdmin={session.role === 'admin'} />}
        {activeTab === 5 && <TrendsTab notes={notes} />}
        {activeTab === 6 && <AttendanceTab characters={characters} notes={notes} sheetId={session.sheetId} />}
        {activeTab === 7 && <ReportTab notes={notes} production={production} sheetId={session.sheetId} session={session} />}
        {activeTab === 8 && <SendTab notes={notes} characters={characters} sheetId={session.sheetId} production={production} session={session} />}
      </div>
      {/* Bottom nav — mobile only */}
      <nav className="bottom-nav">
        {[
          { icon: '✏️', label: 'Log',      idx: 0 },
          { icon: '📋', label: 'Review',   idx: 1 },
          { icon: '👤', label: 'Cast',     idx: 2 },
          { icon: '📅', label: 'Calendar', idx: 3 },
          { icon: '📁', label: 'Docs',     idx: 4 },
          { icon: '📊', label: 'Trends',   idx: 5 },
          { icon: '✉️', label: 'Send',     idx: 8 },
        ].map(({ icon, label, idx }) => (
          <button key={label} className={`bottom-nav-btn ${activeTab === idx ? 'active' : ''}`}
            onClick={() => setActiveTab(idx)}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
