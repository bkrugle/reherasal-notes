import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'
import { api } from '../lib/api'

export default function PlatformPage() {
  const navigate = useNavigate()
  const { login } = useSession()
  const [pin, setPin] = useState('')
  const [platformPin, setPlatformPin] = useState(() => {
    try { return localStorage.getItem("rn_platform_pin") || '' } catch { return '' }
  })
  const [platformName, setPlatformName] = useState(() => {
    try { return localStorage.getItem("rn_platform_name") || '' } catch { return '' }
  })
  const [authed, setAuthed] = useState(!!platformPin)
  const [productions, setProductions] = useState([])
  const [loading, setLoading] = useState(false)
  const [entering, setEntering] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (authed && platformPin) loadProductions()
  }, [authed])

  async function authenticate() {
    if (!pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/.netlify/functions/platformAuth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid PIN')
      setPlatformPin(pin.trim())
      setPlatformName(data.name)
      localStorage.setItem("rn_platform_pin", pin.trim())
      localStorage.setItem("rn_platform_name", data.name)
      setAuthed(true)
      setPin('')
    } catch (e) {
      setError('Invalid platform PIN')
    } finally {
      setLoading(false)
    }
  }

  async function loadProductions() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/.netlify/functions/platformListProductions', {
        headers: { 'x-platform-pin': platformPin }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setProductions(data.productions || [])
    } catch (e) {
      setError('Failed to load productions: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function enterProduction(productionCode) {
    setEntering(productionCode)
    try {
      const res = await fetch('/.netlify/functions/platformImpersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformPin, productionCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      // Store platform pin so we can return to platform dashboard
      localStorage.setItem("rn_platform_pin", platformPin)
      localStorage.setItem("rn_platform_name", platformName)
      login(data)
      navigate('/production')
    } catch (e) {
      setError('Failed to enter production: ' + e.message)
    } finally {
      setEntering(null)
    }
  }

  async function deleteProduction(productionCode, title) {
    if (!confirm(`Delete "${title}"? This is permanent and cannot be undone.`)) return
    if (!confirm(`FINAL WARNING: Delete "${title}" and all its data?`)) return
    setDeleting(productionCode)
    try {
      await api.deleteProduction(
        productions.find(p => p.productionCode === productionCode)?.sheetId,
        productionCode
      )
      setProductions(p => p.filter(x => x.productionCode !== productionCode))
    } catch (e) {
      setError('Delete failed: ' + e.message)
    } finally {
      setDeleting(null)
    }
  }

  function logout() {
    localStorage.removeItem("rn_platform_pin")
    localStorage.removeItem("rn_platform_name")
    setPlatformPin('')
    setPlatformName('')
    setAuthed(false)
    setProductions([])
  }

  const filtered = productions.filter(p =>
    !search ||
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.productionCode.toLowerCase().includes(search.toLowerCase()) ||
    p.directorName.toLowerCase().includes(search.toLowerCase())
  )

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎭</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Ovature Platform</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Super admin access</p>
          </div>
          <div className="card">
            {error && <p style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 12 }}>{error}</p>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Platform PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && authenticate()}
                placeholder="Enter platform PIN"
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={authenticate} disabled={loading}>
              {loading ? 'Authenticating…' : 'Sign in →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--accent)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>🎭 Ovature Platform</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Signed in as {platformName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={loadProductions}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', borderColor: 'transparent' }}>
            ↻ Refresh
          </button>
          <button className="btn btn-sm" onClick={logout}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', borderColor: 'transparent' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
          {[
            { n: productions.length, label: 'Productions' },
            { n: productions.reduce((a, p) => a + p.noteCount, 0), label: 'Total notes' },
            { n: productions.reduce((a, p) => a + p.teamCount, 0), label: 'Team members' },
          ].map(({ n, label }) => (
            <div key={label} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search productions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', fontSize: 14, padding: '8px 12px', marginBottom: '1rem', boxSizing: 'border-box' }}
        />

        {/* Productions list */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>Loading productions…</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>No productions found</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => (
              <div key={p.productionCode} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{p.title || 'Untitled'}</span>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: 'var(--bg2)', color: 'var(--text3)', fontFamily: 'monospace' }}>
                      {p.productionCode}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {p.directorName && <span>👤 {p.directorName}</span>}
                    {p.showDates && <span>📅 {p.showDates}</span>}
                    <span>📝 {p.noteCount} notes</span>
                    <span>👥 {p.teamCount} team</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => enterProduction(p.productionCode)}
                    disabled={entering === p.productionCode}
                    style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', borderColor: 'transparent', fontWeight: 500 }}>
                    {entering === p.productionCode ? '…' : 'Enter →'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => deleteProduction(p.productionCode, p.title)}
                    disabled={deleting === p.productionCode}>
                    {deleting === p.productionCode ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
