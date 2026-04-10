import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

export default function LandingPage() {
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useSession()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!code.trim() || !pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await api.authenticate(code.trim(), pin.trim())
      login(data)
      navigate('/production')
    } catch (err) {
      setError(err.message || 'Invalid production code or PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 48, marginBottom: '0.75rem' }}>🎭</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Rehearsal Notes</h1>
          <p className="muted">Enter your production code and PIN to continue</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin}>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label>Production code</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SPEL7K2"
                autoCapitalize="characters"
                autoComplete="off"
                style={{ letterSpacing: '0.08em', fontWeight: 500 }}
              />
            </div>
            <div className="field" style={{ marginBottom: '1.25rem' }}>
              <label>PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Your production PIN"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Enter production'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: 13, color: 'var(--text3)' }}>
          Starting a new production?{' '}
          <button
            onClick={() => navigate('/create')}
            style={{ background: 'none', border: 'none', color: 'var(--blue-text)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  )
}
