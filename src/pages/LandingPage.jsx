import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

// ── Followspot logo — same as docs/flyer ──────────────────────────────────────
function OvatureLogo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lp-beam" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.05"/>
        </linearGradient>
        <linearGradient id="lp-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b"/>
          <stop offset="100%" stopColor="#4c1d95"/>
        </linearGradient>
      </defs>
      {/* beam */}
      <path d="M22 32 L8 56 L48 56 L34 32 Z" fill="url(#lp-beam)"/>
      {/* fixture body */}
      <ellipse cx="28" cy="22" rx="14" ry="18" fill="url(#lp-body)"/>
      <ellipse cx="28" cy="22" rx="14" ry="18" fill="none" stroke="#7c3aed" strokeWidth="1.5" opacity="0.7"/>
      {/* front lens */}
      <ellipse cx="28" cy="32" rx="12" ry="5" fill="#0a0a0a" stroke="#7c3aed" strokeWidth="1.5"/>
      <ellipse cx="28" cy="32" rx="8" ry="3.2" fill="#fbbf24" opacity="0.9"/>
      <ellipse cx="28" cy="31.5" rx="3.5" ry="1.5" fill="#fff" opacity="0.95"/>
      {/* yoke */}
      <rect x="10" y="17" width="36" height="3" rx="1.5" fill="#374151"/>
      <rect x="10" y="18" width="3" height="10" rx="1.5" fill="#374151"/>
      <rect x="43" y="18" width="3" height="10" rx="1.5" fill="#374151"/>
      {/* circuit dots */}
      <circle cx="24" cy="22" r="1.5" fill="#a78bfa" opacity="0.8"/>
      <circle cx="28" cy="19" r="1.5" fill="#a78bfa" opacity="0.8"/>
      <circle cx="32" cy="22" r="1.5" fill="#a78bfa" opacity="0.8"/>
    </svg>
  )
}

// ── Shared page wrapper ───────────────────────────────────────────────────────
function PageShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d0d0d 0%, #1e1b4b 50%, #0d0d0d 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      {/* subtle grid pattern overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.08) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}/>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        {children}
      </div>
    </div>
  )
}

// ── Brand header ──────────────────────────────────────────────────────────────
function BrandHeader({ subtitle }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
        <OvatureLogo size={52} />
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontSize: 42, fontWeight: 900, letterSpacing: '-2.5px', lineHeight: 1,
            color: '#fff',
          }}>
            <span style={{ color: '#a78bfa' }}>Ov</span>ature<sup style={{ fontSize: 14, fontWeight: 400, verticalAlign: 'super', color: 'rgba(167,139,250,0.7)', letterSpacing: 0 }}>™</sup>
          </div>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '2.5px',
            textTransform: 'uppercase', color: '#6d28d9', marginTop: 3,
          }}>
            Theater Production Platform
          </div>
        </div>
      </div>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function LoginCard({ children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(124,58,237,0.3)',
      borderRadius: 16,
      padding: '1.75rem',
      backdropFilter: 'blur(12px)',
    }}>
      {children}
    </div>
  )
}

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(124,58,237,0.4)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 15,
  padding: '10px 14px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.5px',
  color: 'rgba(255,255,255,0.55)',
  marginBottom: 6,
  textTransform: 'uppercase',
}

function PrimaryBtn({ children, disabled, onClick, type = 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        width: '100%',
        background: disabled ? 'rgba(109,40,217,0.4)' : '#6d28d9',
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontSize: 15,
        fontWeight: 700,
        padding: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        letterSpacing: '-0.2px',
      }}>
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        background: 'none', border: 'none',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13, cursor: 'pointer',
        textDecoration: 'underline',
        padding: 0,
      }}>
      {children}
    </button>
  )
}

function LinkBtn({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        background: 'none', border: 'none',
        color: '#a78bfa',
        fontSize: 13, cursor: 'pointer', fontWeight: 600,
        padding: 0,
      }}>
      {children}
    </button>
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      background: 'rgba(239,68,68,0.15)',
      border: '1px solid rgba(239,68,68,0.4)',
      borderRadius: 8, padding: '8px 12px',
      fontSize: 13, color: '#fca5a5',
      marginBottom: '1rem',
    }}>
      {msg}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [inviteStep, setInviteStep] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [settingPin, setSettingPin] = useState(false)

  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')

  const { login } = useSession()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!code.trim() || !pin.trim()) return
    setLoading(true); setError('')
    try {
      const data = await api.authenticate(code.trim(), pin.trim())
      if (data.status === 'invite_valid') { setInviteStep(data); setLoading(false); return }
      login(data)
      navigate('/production')
    } catch (err) {
      setError(err.message || 'Invalid production code or PIN')
    } finally { setLoading(false) }
  }

  async function handleSetPin(e) {
    e.preventDefault()
    if (!newPin || newPin.length < 4) { setError('PIN must be at least 4 characters'); return }
    if (newPin !== newPinConfirm) { setError('PINs do not match'); return }
    setSettingPin(true); setError('')
    try {
      const data = await api.authenticateWithNewPin(inviteStep.productionCode, inviteStep.inviteCode, newPin)
      login(data); navigate('/production')
    } catch (err) {
      setError(err.message || 'Failed to set PIN')
    } finally { setSettingPin(false) }
  }

  async function handleRecovery(e) {
    e.preventDefault()
    if (!recoveryEmail.trim()) return
    setRecoveryLoading(true); setRecoveryError('')
    try {
      await api.recoverProductionCode(recoveryEmail.trim(), window.location.origin)
      setRecoverySent(true)
    } catch (err) {
      setRecoveryError(err.message || 'Something went wrong')
    } finally { setRecoveryLoading(false) }
  }

  // ── Recovery screen ──
  if (showRecovery) {
    return (
      <PageShell>
        <BrandHeader subtitle="Recovery" />
        <LoginCard>
          {recoverySent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Check your email</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                If an account exists for {recoveryEmail}, we've sent the production code(s) to that address.
              </p>
              <PrimaryBtn onClick={() => { setShowRecovery(false); setRecoverySent(false); setRecoveryEmail('') }} type="button">
                Back to sign in
              </PrimaryBtn>
            </div>
          ) : (
            <form onSubmit={handleRecovery}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Enter the email address you used when creating your production.
              </p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Director email</label>
                <input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)}
                  placeholder="email@example.com" autoFocus required style={inputStyle} />
              </div>
              <ErrorMsg msg={recoveryError} />
              <PrimaryBtn disabled={recoveryLoading}>
                {recoveryLoading ? 'Sending…' : 'Send recovery email'}
              </PrimaryBtn>
            </form>
          )}
        </LoginCard>
        {!recoverySent && (
          <p style={{ textAlign: 'center', marginTop: '1rem' }}>
            <GhostBtn onClick={() => setShowRecovery(false)}>← Back to sign in</GhostBtn>
          </p>
        )}
      </PageShell>
    )
  }

  // ── Invite PIN setup screen ──
  if (inviteStep) {
    return (
      <PageShell>
        <BrandHeader subtitle={`Welcome, ${inviteStep.name || 'there'}! Set a PIN to secure your access to ${inviteStep.title}.`} />
        <LoginCard>
          <form onSubmit={handleSetPin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Choose a PIN</label>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
                placeholder="At least 4 characters" autoFocus style={inputStyle} />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Confirm PIN</label>
              <input type="password" value={newPinConfirm} onChange={e => setNewPinConfirm(e.target.value)}
                placeholder="Repeat your PIN" style={inputStyle} />
            </div>
            <ErrorMsg msg={error} />
            <PrimaryBtn disabled={settingPin}>
              {settingPin ? 'Setting up…' : 'Set PIN and enter'}
            </PrimaryBtn>
          </form>
        </LoginCard>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          You'll use this PIN every time you sign in.
        </p>
      </PageShell>
    )
  }

  // ── Main login screen ──
  return (
    <PageShell>
      <BrandHeader subtitle="Enter your production code and PIN to continue." />
      <LoginCard>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Production code</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SPEL7K2"
              autoCapitalize="characters" autoComplete="off"
              style={{ ...inputStyle, letterSpacing: '0.12em', fontWeight: 700, fontSize: 18 }} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>PIN or invite code</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="Your PIN" autoComplete="current-password" style={inputStyle} />
          </div>
          <ErrorMsg msg={error} />
          <PrimaryBtn disabled={loading}>
            {loading ? 'Signing in…' : 'Enter production →'}
          </PrimaryBtn>
        </form>
      </LoginCard>

      <div style={{ textAlign: 'center', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Starting a new production?{' '}
          <LinkBtn onClick={() => navigate('/create')}>Create one</LinkBtn>
        </p>
        <GhostBtn onClick={() => setShowRecovery(true)}>Forgot production code?</GhostBtn>
      </div>
    </PageShell>
  )
}
