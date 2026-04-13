import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function CastPortalPage() {
  const { productionCode } = useParams()
  const [production, setProduction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCast, setSelectedCast] = useState(() => localStorage.getItem(`rn_portal_cast_${productionCode}`) || '')
  const [notes, setNotes] = useState([])
  const [checkinStatus, setCheckinStatus] = useState(null)
  const showDate = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getPublicCheckinStatus(productionCode, showDate)
        setCheckinStatus(data)
        // Fetch full production config (for curtain times, etc.) using sheetId
        if (data.sheetId) {
          try {
            const prod = await api.getProduction(data.sheetId)
            setProduction(prod)
          } catch {}
        }
      } catch (e) {
        setError('Production not found')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [productionCode])

  useEffect(() => {
    if (!selectedCast || !production) return
    localStorage.setItem(`rn_portal_cast_${productionCode}`, selectedCast)
    // Load notes for this cast member via public checkin endpoint
    // Notes are loaded from the sheet using the sheetId we get from checkin status
    if (checkinStatus?.sheetId) {
      api.getNotes(checkinStatus.sheetId)
        .then(d => {
          const all = d.notes || []
          const mine = all.filter(n =>
            n.characters?.includes(selectedCast) || n.text?.toLowerCase().includes(selectedCast.toLowerCase())
          ).filter(n => n.status === 'open').slice(0, 10)
          setNotes(mine)
        })
        .catch(() => {})
    }
  }, [selectedCast, production, checkinStatus])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)' }}>
      <p style={{ color: 'var(--text3)' }}>Loading…</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 20 }}>🎭</p>
        <p style={{ color: 'var(--text2)' }}>{error}</p>
      </div>
    </div>
  )

  const config = production?.config || {}
  const title = checkinStatus?.productionTitle || config.title || 'Production'
  const castList = (checkinStatus?.castList || []).map(c => typeof c === 'string' ? c : c.name).filter(Boolean)
  const checkins = (checkinStatus?.checkins || []).map(c => typeof c === 'string' ? { castName: c } : c)
  const myCheckin = checkins.find(c => c.castName === selectedCast)
  const curtainTimes = (() => {
    try { const raw = config.curtainTimes; return typeof raw === 'object' ? raw : JSON.parse(raw || '{}') } catch { return {} }
  })()
  const todayCurtain = curtainTimes[showDate]

  // Mic assignment
  const micData = (() => {
    try {
      const key = `rn_mics_${checkinStatus?.sheetId || ''}`
      const mics = JSON.parse(localStorage.getItem(key) || '[]')
      return mics.find(m => m.assignedTo === selectedCast)
    } catch { return null }
  })()

  if (!selectedCast || !castList.includes(selectedCast)) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ maxWidth: 400, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎭</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{title}</h1>
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>Cast portal · {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', border: '0.5px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Who are you?</p>
            {castList.length === 0
              ? <p style={{ color: 'var(--text3)', fontSize: 13 }}>No cast list set up yet.</p>
              : castList.map(name => (
                <button key={name} onClick={() => setSelectedCast(name)}
                  style={{ width: '100%', padding: '12px 16px', marginBottom: 6, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 500, cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                  {name}
                </button>
              ))
            }
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg3)', padding: '1rem' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'var(--accent, #1a365d)', borderRadius: 'var(--radius-xl)', padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{title}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Hey, {selectedCast.split(' ')[0]}! 👋</p>
            </div>
            <button onClick={() => setSelectedCast('')}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'rgba(255,255,255,0.8)', fontSize: 12, cursor: 'pointer' }}>
              Switch
            </button>
          </div>
        </div>

        {/* Tonight's info */}
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: 12, border: '0.5px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 10 }}>Tonight</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Curtain</p>
              <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {todayCurtain ? new Date(`1970-01-01T${todayCurtain}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div style={{ flex: 1, background: myCheckin ? 'var(--green-bg)' : 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 12px', border: `0.5px solid ${myCheckin ? 'var(--green-text)' : 'var(--border)'}` }}>
              <p style={{ fontSize: 11, color: myCheckin ? 'var(--green-text)' : 'var(--text3)', margin: 0 }}>Check-in</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: myCheckin ? 'var(--green-text)' : 'var(--text3)', margin: 0 }}>
                {myCheckin ? `✓ ${new Date(myCheckin.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not yet'}
              </p>
            </div>
            {micData && (
              <div style={{ flex: 1, background: 'var(--blue-bg)', borderRadius: 'var(--radius)', padding: '10px 12px', border: '0.5px solid var(--blue-text)' }}>
                <p style={{ fontSize: 11, color: 'var(--blue-text)', margin: 0 }}>Mic</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue-text)', margin: 0 }}>#{micData.num}</p>
              </div>
            )}
          </div>
        </div>

        {/* Notes from director */}
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-xl)', padding: '16px', border: '0.5px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 10 }}>Your notes from director</p>
          {notes.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '1rem 0' }}>No notes yet — go be great! 🌟</p>
            : notes.slice(0, 10).map((n, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < notes.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{n.text}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{n.scene || n.date}</p>
                </div>
              ))
          }
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 16 }}>
          {title} · Powered by Ovature™
        </p>
      </div>
    </div>
  )
}
