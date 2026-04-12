import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'

const NAV_SECTIONS = [
  { label: 'Rehearsal', items: [
    { label: 'Home', idx: 0, path: '/production', icon: 'home' },
    { label: 'Log note', idx: 1, icon: 'edit' },
    { label: 'Review', idx: 2, icon: 'clipboard' },
    { label: 'By cast', idx: 3, icon: 'users' },
    { label: 'Calendar', idx: 4, icon: 'calendar' },
  ]},
  { label: 'Communications', items: [
    { label: 'Send notes', idx: 9, icon: 'send' },
    { label: 'Report', idx: 8, icon: 'file' },
    { label: 'Documents', idx: 5, icon: 'folder' },
  ]},
  { label: 'Analytics', items: [
    { label: 'Trends', idx: 6, icon: 'trending' },
    { label: 'Attendance', idx: 7, icon: 'check-square' },
  ]},
  { label: 'Show', items: [
    { label: 'Show day', idx: 11, icon: 'video', special: true },
    { label: 'Check-in', idx: 12, icon: 'clock' },
    { label: 'Mic tracker', idx: 13, icon: 'mic' },
    { label: 'Pre-show', idx: 14, icon: 'list' },
    { label: 'Intermission', idx: 15, icon: 'coffee' },
    { label: 'Auditions', idx: 10, icon: 'star', auditionsOnly: true },
  ]},
]

const ICONS = {
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
  mic: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></>,
  list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
  coffee: <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></>,
}

function NavIcon({ name }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      {ICONS[name] || null}
    </svg>
  )
}

export default function AppShell({ children, title, productionCode, activeTab, onTabChange, showDayMode, openNotesCount, useAuditions, topBarContent, onLogout, onShowDay, showDates, isShowDay }) {
  const navigate = useNavigate()
  const { session, logout } = useSession()
  const isSetup = !onTabChange

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('rn_darkmode')
    if (saved === 'dark') return 'dark'
    if (saved === 'light') return 'light'
    return 'system'
  })

  useEffect(() => {
    const html = document.documentElement
    if (darkMode === 'dark') {
      html.classList.add('dark'); html.classList.remove('light')
    } else if (darkMode === 'light') {
      html.classList.add('light'); html.classList.remove('dark')
    } else {
      html.classList.remove('dark', 'light')
    }
    if (darkMode !== 'system') localStorage.setItem('rn_darkmode', darkMode)
    else localStorage.removeItem('rn_darkmode')
  }, [darkMode])

  function cycleDarkMode() {
    setDarkMode(m => m === 'system' ? 'dark' : m === 'dark' ? 'light' : 'system')
  }

  const darkLabel = darkMode === 'dark' ? 'Dark' : darkMode === 'light' ? 'Light' : 'Auto'
  const darkIcon = darkMode === 'dark' ? '🌙' : darkMode === 'light' ? '☀️' : '⚙️' // Setup page doesn't pass onTabChange

  function handleNav(item) {
    if (isSetup) {
      navigate('/production')
    } else if (onTabChange) {
      onTabChange(item.idx)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="desktop-layout">

        {/* Sidebar */}
        <aside className="app-sidebar">
          <div className="sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <div className="sidebar-logo-icon">🎭</div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="sidebar-show-title">{title || 'Ovature'}</div>
                <div className="sidebar-show-sub">{productionCode || session?.productionCode}</div>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {NAV_SECTIONS.map(section => {
              const items = section.items.filter(i => !i.auditionsOnly || useAuditions)
              if (!items.length) return null
              return (
                <div key={section.label} className="sidebar-section">
                  <div className="sidebar-section-label">{section.label}</div>
                  {items.map(item => {
                    if (item.special) {
                      if (!isShowDay) return null
                      return (
                        <button key={item.idx}
                          className={`sidebar-nav-showday ${activeTab === 11 ? 'active' : ''}`}
                          onClick={() => onShowDay ? onShowDay() : handleNav(item)}>
                          <NavIcon name={item.icon} />
                          {item.label}
                          {showDayMode && <span style={{ marginLeft: 'auto', fontSize: 9, background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '1px 5px' }}>ON</span>}
                        </button>
                      )
                    }
                    const isActive = !isSetup && activeTab === item.idx
                    return (
                      <button key={item.idx}
                        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleNav(item)}>
                        <NavIcon name={item.icon} />
                        {item.label}
                        {item.idx === 0 && openNotesCount > 0 && (
                          <span className="sidebar-badge sidebar-badge-red">{openNotesCount}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <button className="sidebar-nav-item" style={{ width: '100%' }} onClick={cycleDarkMode}>
              <span style={{ fontSize: 13 }}>{darkIcon}</span>
              <span>{darkLabel} mode</span>
            </button>
            {session?.role === 'admin' && (
              <button
                className={`sidebar-nav-item ${isSetup ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => navigate('/setup')}>
                <NavIcon name="settings" />
                Settings
              </button>
            )}
            {isSetup && (
              <button className="sidebar-nav-item" style={{ width: '100%' }}
                onClick={() => navigate('/production?showday=1')}>
                <NavIcon name="video" />
                Launch Show Day
              </button>
            )}
            <button className="sidebar-nav-item" style={{ width: '100%' }}
              onClick={() => { logout(); navigate('/') }}>
              <NavIcon name="logout" />
              {session?.name || 'Sign out'}
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="app-main">
          <header className="app-main-topbar">
            {topBarContent || <div />}
          </header>
          {children}
        </div>

      </div>
    </div>
  )
}
