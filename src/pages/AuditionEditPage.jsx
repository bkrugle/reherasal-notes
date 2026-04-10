import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function AuditionEditPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [photo, setPhoto] = useState(null)
  const photoRef = useRef(null)
  const cameraRef = useRef(null)
  const [form, setForm] = useState(null)

  // Need production code — stored in URL search or prompt
  const params = new URLSearchParams(window.location.search)
  const productionCode = params.get('code') || ''

  useEffect(() => {
    if (!productionCode) { setError('Missing production code in URL'); setLoading(false); return }
    api.getAuditionByToken(productionCode, token)
      .then(d => {
        setData(d)
        setForm({
          firstName: d.auditioner.firstName,
          lastName: d.auditioner.lastName,
          email: d.auditioner.email,
          phone: d.auditioner.phone,
          grade: d.auditioner.grade,
          age: d.auditioner.age,
          experience: d.auditioner.experience,
          conflicts: d.auditioner.conflicts,
          customAnswers: d.auditioner.customAnswers || {}
        })
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [token, productionCode])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function setCustom(q, val) { setForm(f => ({ ...f, customAnswers: { ...f.customAnswers, [q]: val } })) }

  async function handlePhoto(e) {
    const file = e.target.files[0]; if (!file) return
    const preview = URL.createObjectURL(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image(); img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 800; let { width, height } = img
        if (width > MAX || height > MAX) { if (width > height) { height = Math.round(height * MAX / width); width = MAX } else { width = Math.round(width * MAX / height); height = MAX } }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        setPhoto({ base64: canvas.toDataURL('image/jpeg', 0.82).split(',')[1], preview })
      }; img.src = ev.target.result
    }; reader.readAsDataURL(file)
  }

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.submitAudition({
        sheetId: data.sheetId,
        appUrl: window.location.origin,
        productionTitle: data.productionTitle,
        editToken: token,
        ...form,
        headshotBase64: photo?.base64 || ''
      })
      setSubmitted(true)
    } catch (e) {
      setError('Failed to update: ' + e.message)
    } finally { setSubmitting(false) }
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--text2)' }}>Loading…</p></div>
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}><div style={{ textAlign: 'center' }}><p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Couldn't load your form</p><p style={{ color: 'var(--text2)' }}>{error}</p></div></div>
  if (submitted) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 48 }}>✓</div><h1 style={{ fontSize: 20, fontWeight: 600, marginTop: '1rem' }}>Information updated!</h1><p style={{ color: 'var(--text2)', marginTop: 8 }}>Your audition form has been updated.</p></div></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg3)', padding: '2rem 1rem 4rem' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 40, marginBottom: '0.75rem' }}>🎭</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{data.productionTitle}</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Update your audition information</p>
        </div>
        <div className="card">
          <form onSubmit={submit}>
            <div className="grid2" style={{ marginBottom: '1rem' }}>
              <div className="field"><label>First name *</label><input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)} required /></div>
              <div className="field"><label>Last name *</label><input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)} required /></div>
            </div>
            <div className="grid2" style={{ marginBottom: '1rem' }}>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div className="field"><label>Phone</label><input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            </div>
            <div className="grid2" style={{ marginBottom: '1rem' }}>
              <div className="field"><label>Grade</label>
                <select value={form.grade} onChange={e => set('grade', e.target.value)}>
                  <option value="">Select grade</option>
                  {['6','7','8','9','10','11','12','College/Adult'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="field"><label>Age</label><input type="number" min="8" max="100" value={form.age} onChange={e => set('age', e.target.value)} /></div>
            </div>
            <div className="field" style={{ marginBottom: '1rem' }}><label>Theater experience</label><textarea rows={3} value={form.experience} onChange={e => set('experience', e.target.value)} /></div>
            <div className="field" style={{ marginBottom: '1rem' }}><label>Schedule conflicts</label><textarea rows={2} value={form.conflicts} onChange={e => set('conflicts', e.target.value)} /></div>
            {(data.auditionQuestions || []).map((q, i) => (
              <div key={i} className="field" style={{ marginBottom: '1rem' }}>
                <label>{q}</label>
                <textarea rows={2} value={form.customAnswers[q] || ''} onChange={e => setCustom(q, e.target.value)} />
              </div>
            ))}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, display: 'block', marginBottom: 8 }}>Update headshot (optional)</label>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="user" onChange={handlePhoto} style={{ display: 'none' }} />
              {!photo ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={() => cameraRef.current?.click()}>📷 Camera</button>
                  <button type="button" className="btn btn-sm" onClick={() => photoRef.current?.click()}>🖼 Upload</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={photo.preview} alt="headshot" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                  <button type="button" className="btn btn-sm" onClick={() => setPhoto(null)}>Remove</button>
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
