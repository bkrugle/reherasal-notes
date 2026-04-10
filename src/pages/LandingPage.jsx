import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

export default function LandingPage() {
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Invite / PIN setup flow
  const [inviteStep, setInviteStep] = useState(null)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('') // { productionCode, title, sheetId, name, email, inviteCode }
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [settingPin, setSettingPin] = useState(false)

  const { login } = useSession()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!code.trim() || !pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await api.authenticate(code.trim(), pin.trim())
      if (data.status === 'invite_valid') {
        // Invite code accepted — prompt for new PIN
        setInviteStep(data)
        setLoading(false)
        return
      }
      login(data)
      navigate('/production')
    } catch (err) {
      setError(err.message || 'Invalid production code or PIN')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecovery(e) {
    e.preventDefault()
    if (!recoveryEmail.trim()) return
    setRecoveryLoading(true)
    setRecoveryError('')
    try {
      await api.recoverProductionCode(recoveryEmail.trim(), window.location.origin)
      setRecoverySent(true)
    } catch (err) {
      setRecoveryError(err.message || 'Something went wrong')
    } finally {
      setRecoveryLoading(false)
    }
  }

  async function handleSetPin(e) {
    e.preventDefault()
    if (!newPin || newPin.length < 4) { setError('PIN must be at least 4 characters'); return }
    if (newPin !== newPinConfirm) { setError('PINs do not match'); return }
    setSettingPin(true)
    setError('')
    try {
      const data = await api.authenticateWithNewPin(
        inviteStep.productionCode,
        inviteStep.inviteCode,
        newPin
      )
      login(data)
      navigate('/production')
    } catch (err) {
      setError(err.message || 'Failed to set PIN')
    } finally {
      setSettingPin(false)
    }
  }

  // Recovery screen
  if (showRecovery) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: 48, marginBottom: '0.75rem' }}>🎭</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Recover production code</h1>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Enter the email address you used when setting up the production.</p>
          </div>
          <div className="card">
            {recoverySent ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontSize: 22, marginBottom: '0.75rem' }}>✉️</p>
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Check your email</p>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.5rem' }}>
                  If an account exists for {recoveryEmail}, we've sent the production code(s) to that address.
                </p>
                <button className="btn btn-full" onClick={() => { setShowRecovery(false); setRecoverySent(false); setRecoveryEmail('') }}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecovery}>
                <div className="field" style={{ marginBottom: '1.25rem' }}>
                  <label>Director email address</label>
                  <input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)}
                    placeholder="email@example.com" autoFocus required />
                </div>
                {recoveryError && (
                  <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                    {recoveryError}
                  </p>
                )}
                <button type="submit" className="btn btn-primary btn-full" disabled={recoveryLoading}>
                  {recoveryLoading ? 'Sending…' : 'Send recovery email'}
                </button>
              </form>
            )}
          </div>
          {!recoverySent && (
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: 13, color: 'var(--text3)' }}>
              <button onClick={() => setShowRecovery(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>
                ← Back to sign in
              </button>
            </p>
          )}
        </div>
      </div>
    )
  }

  // Invite PIN setup screen
  if (inviteStep) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: 48, marginBottom: '0.75rem' }}>🎭</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Welcome, {inviteStep.name || 'there'}!</h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}>{inviteStep.title}</p>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Choose a PIN to secure your account.</p>
          </div>

          <div className="card">
            <form onSubmit={handleSetPin}>
              <div className="field" style={{ marginBottom: '1rem' }}>
                <label>Choose a PIN</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  placeholder="At least 4 characters"
                  autoFocus
                />
              </div>
              <div className="field" style={{ marginBottom: '1.25rem' }}>
                <label>Confirm PIN</label>
                <input
                  type="password"
                  value={newPinConfirm}
                  onChange={e => setNewPinConfirm(e.target.value)}
                  placeholder="Repeat your PIN"
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-primary btn-full" disabled={settingPin}>
                {settingPin ? 'Setting up…' : 'Set PIN and enter'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: 12, color: 'var(--text3)' }}>
            You'll use this PIN every time you sign in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 48, marginBottom: '0.75rem' }}>🎭</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Rehearsal Notes</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Enter your production code and PIN — or your invite code — to continue</p>
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
              <label>PIN or invite code</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Your PIN or one-time invite code"
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

        <div style={{ textAlign: 'center', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Starting a new production?{' '}
            <button onClick={() => navigate('/create')}
              style={{ background: 'none', border: 'none', color: 'var(--blue-text)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              Create one
            </button>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            <button onClick={() => setShowRecovery(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
              Forgot production code?
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
