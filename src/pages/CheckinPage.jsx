import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function CheckinPage() {
  const { productionCode, showDate } = useParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null) // { castName, checkedInAt, alreadyCheckedIn }
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getPublicCheckinStatus(productionCode, showDate)
      .then(data => { setStatus(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [productionCode, showDate])

  async function checkin() {
    if (!selected) return
    setSubmitting(true)
    try {
      const result = await api.showCheckin({ productionCode, showDate, castName: selected, note })
      setDone({ castName: selected, checkedInAt: result.checkedInAt, alreadyCheckedIn: result.alreadyCheckedIn })
    } catch (e) {
      setError('Check-in failed: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const dt = new Date(showDate + 'T00:00:00')
  const dateLabel = dt.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  const timeLabel = done ? new Date(done.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''

  const checkedInNames = new Set(status?.checkins?.map(c => c.castName) || [])
  // castList may contain objects {name, castMember} or plain strings
  const castListNormalized = (status?.castList || []).map(c =>
    typeof c === 'string' ? { name: c, castMember: '' } : c
  )
  const filtered = castListNormalized.filter(c => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return c.name.toLowerCase().includes(searchLower) ||
      (c.castMember && c.castMember.toLowerCase().includes(searchLower))
  })
  const notIn = filtered.filter(c => !checkedInNames.has(c.name))
  const alreadyIn = filtered.filter(c => checkedInNames.has(c.name))

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

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>{done.alreadyCheckedIn ? '👍' : '✅'}</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
          {done.alreadyCheckedIn ? 'Already checked in!' : 'You\'re checked in!'}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 6 }}>{done.castName}</p>
        <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 24 }}>
          {done.alreadyCheckedIn ? 'You checked in earlier' : `Checked in at ${timeLabel}`}
        </p>
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            🎭 <strong>{status?.productionTitle}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{dateLabel}</p>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Break a leg tonight! 🌟</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', padding: '0 0 2rem' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', padding: '1rem 1.25rem 0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>🎭</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{status?.productionTitle}</p>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>{dateLabel} · Cast check-in</p>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <input
            type="text"
            placeholder="Search your name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', fontSize: 15, padding: '8px 12px', boxSizing: 'border-box' }}
            autoFocus
          />
        </div>
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>

        {/* Not yet checked in */}
        {notIn.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {!search && <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Tap your name to check in</p>}
            {notIn.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelected(selected === c.name ? '' : c.name)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '12px 14px', marginBottom: 6, borderRadius: 'var(--radius)',
                  border: selected === c.name ? '2px solid var(--text)' : '0.5px solid var(--border)',
                  background: selected === c.name ? 'var(--bg2)' : 'var(--bg)',
                  cursor: 'pointer', color: 'var(--text)'
                }}
              >
                <span style={{ fontSize: 15, fontWeight: selected === c.name ? 600 : 500 }}>
                  {selected === c.name ? '✓ ' : ''}{c.castMember || c.name}
                </span>
                {c.castMember && (
                  <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                    {c.name}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Selected — confirm + note */}
        {selected && (
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Checking in as <strong>{selected}</strong></p>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Note (optional)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. Running 5 min late, costume issue…" style={{ fontSize: 14 }} />
            </div>
            <button className="btn btn-primary btn-full" onClick={checkin} disabled={submitting}>
              {submitting ? 'Checking in…' : `✓ Check in as ${selected}`}
            </button>
          </div>
        )}

        {/* Already checked in */}
        {alreadyIn.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              ✅ Already checked in ({alreadyIn.length})
            </p>
            {alreadyIn.map(c => {
              const entry = status.checkins.find(ci => ci.castName === c.name)
              const t = entry ? new Date(entry.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
              return (
                <div key={c.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', marginBottom: 4, borderRadius: 'var(--radius)',
                  background: 'var(--bg2)', border: '0.5px solid var(--border)', opacity: 0.7
                }}>
                  <div>
                    <span style={{ fontSize: 14, color: 'var(--text2)' }}>✅ {c.castMember || c.name}</span>
                    {c.castMember && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{c.name}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t}</span>
                </div>
              )
            })}
          </div>
        )}

        {filtered.length === 0 && (
          <p style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', marginTop: 32 }}>
            No results for "{search}"
          </p>
        )}
      </div>
    </div>
  )
}
