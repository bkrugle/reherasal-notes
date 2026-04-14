import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'

const AUTO_RETURN_SECONDS = 5

export default function CheckinPage() {
  const { productionCode, showDate } = useParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null) // { castName, displayName, checkedInAt, alreadyCheckedIn }
  const [search, setSearch] = useState('')
  const [countdown, setCountdown] = useState(AUTO_RETURN_SECONDS)
  const countdownRef = useRef(null)

  const dt = new Date(showDate + 'T00:00:00')
  const dateLabel = dt.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    loadStatus()
  }, [productionCode, showDate])

  async function loadStatus() {
    try {
      const data = await api.getPublicCheckinStatus(productionCode, showDate)
      setStatus(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // Detect mobile
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
    (window.innerWidth < 768 && 'ontouchstart' in window)

  // Auto-return countdown after check-in
  useEffect(() => {
    if (!done) return
    setCountdown(AUTO_RETURN_SECONDS)
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current)
          if (isMobile) {
            // Try to close tab (works if opened via QR/link)
            window.close()
            // If close didn't work (direct nav), return to list
            setTimeout(returnToList, 300)
          } else {
            returnToList()
          }
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current)
  }, [done])

  function returnToList() {
    clearInterval(countdownRef.current)
    setDone(null)
    setSearch('')
    loadStatus()
  }

  async function checkin(castEntry) {
    setSubmitting(castEntry.name)
    try {
      const result = await api.showCheckin({
        productionCode, showDate,
        castName: castEntry.name,
        note: ''
      })
      const displayName = castEntry.castMember || castEntry.name
      setDone({
        castName: castEntry.name,
        displayName,
        group: castEntry.group || null,
        checkedInAt: result.checkedInAt,
        alreadyCheckedIn: result.alreadyCheckedIn
      })
    } catch (e) {
      setError('Check-in failed: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Normalize and filter cast list
  const castListNormalized = (status?.castList || []).map(c => // v2
  typeof c === 'string' ? { name: c, castMember: '', group: null } : { ...c, group: c.group || null }
)
  const checkedInNames = new Set(status?.checkins?.map(c => c.castName) || [])
  const filtered = castListNormalized.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.name.toLowerCase().includes(s) ||
      (c.castMember && c.castMember.toLowerCase().includes(s)) ||
      (c.group && c.group.toLowerCase().includes(s))
  })
  const notIn = filtered.filter(c => !checkedInNames.has(c.name))
  const alreadyIn = filtered.filter(c => checkedInNames.has(c.name))

  // ── Loading ──────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text2)' }}>Loading…</p>
    </div>
  )

  if (error && !status) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎭</div>
        <p style={{ color: 'var(--red-text)' }}>{error}</p>
      </div>
    </div>
  )

  // ── Success screen ────────────────────────────────────────
  if (done) {
    const timeLabel = new Date(done.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const remaining = notIn.filter(c => c.name !== done.castName).length
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'var(--bg)', textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 16, lineHeight: 1 }}>
          {done.alreadyCheckedIn ? '👍' : '✅'}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          {done.alreadyCheckedIn ? 'Already checked in!' : 'You\'re in!'}
        </h1>
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{done.displayName}</p>
        {done.group && (
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>{done.group}</p>
        )}
        <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28 }}>
          {done.alreadyCheckedIn ? 'You checked in earlier' : `Checked in at ${timeLabel}`}
        </p>

        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.5rem', marginBottom: 24, width: '100%', maxWidth: 320 }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>🎭 {status?.productionTitle}</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{dateLabel}</p>
          {remaining > 0 && (
            <p style={{ fontSize: 13, color: 'var(--amber-text)', marginTop: 8, fontWeight: 500 }}>
              {remaining} cast member{remaining !== 1 ? 's' : ''} still need to check in
            </p>
          )}
          {remaining === 0 && (
            <p style={{ fontSize: 13, color: 'var(--green-text)', marginTop: 8, fontWeight: 500 }}>
              🎉 Everyone's checked in!
            </p>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Break a leg tonight! 🌟</p>

        {/* Auto-return countdown */}
        {isMobile ? (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            Closing in {countdown}s… or <button onClick={returnToList} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0 }}>stay on list</button>
          </p>
        ) : (
          <button onClick={returnToList} style={{
            background: 'none', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '8px 20px',
            fontSize: 13, color: 'var(--text3)', cursor: 'pointer'
          }}>
            Back to list ({countdown}s)
          </button>
        )}
      </div>
    )
  }

  // ── Main check-in list ────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', padding: '0 0 2rem' }}>
      {/* Sticky header */}
      <div style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', padding: '1rem 1.25rem 0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>🎭</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{status?.productionTitle}</p>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>{dateLabel} · Cast check-in</p>
          </div>
          {castListNormalized.length > 0 && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: checkedInNames.size === castListNormalized.length ? 'var(--green-text)' : 'var(--text2)' }}>
                {checkedInNames.size}/{castListNormalized.length}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text3)' }}>checked in</p>
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder="Search your name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', fontSize: 15, padding: '8px 12px', boxSizing: 'border-box' }}
          autoFocus
        />
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {/* Not yet checked in */}
        {notIn.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {!search && (
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Tap your name to check in
              </p>
            )}
            {notIn.map(c => (
              <button
                key={c.name}
                type="button"
                disabled={submitting === c.name}
                onClick={() => checkin(c)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '14px 16px', marginBottom: 8,
                  borderRadius: 'var(--radius)',
                  border: '0.5px solid var(--border)',
                  background: submitting === c.name ? 'var(--bg2)' : 'var(--bg)',
                  cursor: submitting === c.name ? 'wait' : 'pointer',
                  color: 'var(--text)',
                  transition: 'background 0.1s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {submitting === c.name ? '⏳ ' : ''}{c.castMember || c.name}
                    </div>
                    {c.castMember && (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.name}</div>
                    )}
                    {c.group && (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.group}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 20, color: 'var(--text3)' }}>→</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {notIn.length === 0 && !search && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Everyone's checked in!</p>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Full house tonight!</p>
          </div>
        )}

        {/* Already checked in */}
        {alreadyIn.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              ✅ Checked in ({alreadyIn.length})
            </p>
            {alreadyIn.map(c => {
              const entry = status.checkins.find(ci => ci.castName === c.name)
              const t = entry ? new Date(entry.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
              return (
                <div key={c.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', marginBottom: 4, borderRadius: 'var(--radius)',
                  background: 'var(--bg2)', border: '0.5px solid var(--border)', opacity: 0.65
                }}>
                  <div>
                    <span style={{ fontSize: 14, color: 'var(--text2)' }}>✅ {c.castMember || c.name}</span>
                    {c.castMember && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{c.name}</span>}
                    {c.group && <span style={{ fontSize: 11, color: 'var(--purple-text)', marginLeft: 6 }}>{c.group}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t}</span>
                </div>
              )
            })}
          </div>
        )}

        {filtered.length === 0 && search && (
          <p style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', marginTop: 32 }}>
            No results for "{search}"
          </p>
        )}
      </div>
    </div>
  )
}

