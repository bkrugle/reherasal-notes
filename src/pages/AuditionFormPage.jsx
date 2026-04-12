import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function AuditionFormPage() {
  const { productionCode } = useParams()
  const [formConfig, setFormConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [photo, setPhoto] = useState(null)
  const photoRef = useRef(null)
  const cameraRef = useRef(null)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    grade: '', age: '', experience: '', conflicts: '',
    customAnswers: {}
  })

  useEffect(() => {
    api.getAuditionForm(productionCode)
      .then(data => { setFormConfig(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [productionCode])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function setCustom(q, val) { setForm(f => ({ ...f, customAnswers: { ...f.customAnswers, [q]: val } })) }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available. Please use Upload photo.')
      return
    }
    setCameraOpen(true)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true })
    } catch (e) {
      setCameraOpen(false)
      setError('Camera error: ' + e.name + ' — ' + e.message)
      return
    }

    // Imperatively create and manage the camera UI — no React rendering involved
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;box-sizing:border-box;'

    const label = document.createElement('p')
    label.textContent = 'Position your face in the frame'
    label.style.cssText = 'color:#fff;font-size:15px;margin:0;font-family:sans-serif;'

    const video = document.createElement('video')
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.srcObject = stream
    video.style.cssText = 'width:100%;max-width:480px;max-height:60vh;object-fit:cover;border-radius:8px;background:#333;'

    const buttons = document.createElement('div')
    buttons.style.cssText = 'display:flex;gap:20px;'

    const snapBtn = document.createElement('button')
    snapBtn.textContent = '📸'
    snapBtn.style.cssText = 'width:72px;height:72px;border-radius:50%;background:#fff;border:none;font-size:28px;cursor:pointer;'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '✕'
    cancelBtn.style.cssText = 'width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);border:2px solid rgba(255,255,255,0.5);color:#fff;font-size:22px;cursor:pointer;'

    function cleanup() {
      stream.getTracks().forEach(t => t.stop())
      document.body.removeChild(overlay)
      document.body.style.overflow = ''
      setCameraOpen(false)
      setCameraStream(null)
    }

    snapBtn.onclick = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      canvas.getContext('2d').drawImage(video, 0, 0)
      const preview = canvas.toDataURL('image/jpeg', 0.85)
      setPhoto({ base64: preview.split(',')[1], preview })
      cleanup()
    }

    cancelBtn.onclick = cleanup

    buttons.appendChild(snapBtn)
    buttons.appendChild(cancelBtn)
    overlay.appendChild(label)
    overlay.appendChild(video)
    overlay.appendChild(buttons)
    document.body.appendChild(overlay)
    document.body.style.overflow = 'hidden'

    video.play().catch(e => console.warn('play failed:', e))

    setError('')
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    }
    setCameraOpen(false)
  }

  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const b64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
        setPhoto({ base64: b64, preview })
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  function buildSmsGateway(phone, carrier) {
    const digits = phone.replace(/\D/g, '')
    const num = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
    if (num.length !== 10 || !carrier || carrier === 'other') return ''
    const suffixes = {
      verizon: '@vtext.com',
      att: '@txt.att.net',
      tmobile: '@tmomail.net',
      sprint: '@messaging.sprintpcs.com'
    }
    return suffixes[carrier] ? num + suffixes[carrier] : ''
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) return
    setSubmitting(true)
    try {
      await api.submitAudition({
        sheetId: formConfig.sheetId,
        headshotFolderId: formConfig.headshotFolderId,
        appUrl: window.location.origin,
        productionTitle: formConfig.productionTitle,
        directorEmail: formConfig.directorEmail,
        productionCode,
        ...form,
        headshotBase64: photo?.base64 || '',
        smsGateway: buildSmsGateway(form.phone, form.carrier)
      })
      setSubmitted(true)
    } catch (e) {
      setError('Failed to submit: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text2)' }}>Loading audition form…</p>
    </div>
  )

  if (error && !formConfig) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Audition form not found</p>
        <p style={{ color: 'var(--text2)' }}>{error}</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 56, marginBottom: '1rem' }}>🎭</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>You're all set!</h1>
        <p style={{ color: 'var(--text2)', lineHeight: 1.6, marginBottom: '2rem' }}>
          Thanks for auditioning for <strong>{formConfig.productionTitle}</strong>!
          {form.email && ' A confirmation email is on its way to you.'}
        </p>
        <button
          className="btn btn-primary btn-full"
          onClick={() => {
            setSubmitted(false)
            setPhoto(null)
            setForm({ firstName: '', lastName: '', email: '', phone: '', carrier: '', grade: '', age: '', experience: '', conflicts: '', customAnswers: {} })
            window.scrollTo(0, 0)
          }}
        >
          Submit another form →
        </button>
        <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: '1rem' }}>Good luck — we'll be in touch!</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg3)', padding: '2rem 1rem 4rem' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 40, marginBottom: '0.75rem' }}>🎭</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{formConfig.productionTitle}</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Audition Registration</p>
        </div>

        <div className="card">
          <form onSubmit={submit}>
            {/* Name */}
            <div className="grid2" style={{ marginBottom: '1rem' }}>
              <div className="field">
                <label>First name *</label>
                <input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
              </div>
              <div className="field">
                <label>Last name *</label>
                <input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
              </div>
            </div>

            {/* Contact */}
            <div className="grid2" style={{ marginBottom: '1rem' }}>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="For confirmation email" />
              </div>
              <div className="field">
                <label>Phone <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
                <input type="tel" value={form.phone} onChange={e => { set('phone', e.target.value); set('carrier', '') }} placeholder="412-555-0100" />
              </div>
            </div>

            {/* Carrier — only show if phone entered */}
            {form.phone.replace(/\D/g, '').length >= 10 && (
              <div className="field" style={{ marginBottom: '1rem' }}>
                <label>Phone carrier <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(for text message updates)</span></label>
                <select value={form.carrier || ''} onChange={e => set('carrier', e.target.value)}>
                  <option value="">Select carrier…</option>
                  <option value="verizon">Verizon</option>
                  <option value="att">AT&T</option>
                  <option value="tmobile">T-Mobile</option>
                  <option value="sprint">Sprint / Boost</option>
                  <option value="other">Other / Unknown</option>
                </select>
                {form.carrier === 'other' && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    No problem — we'll use email for updates instead.
                  </p>
                )}
                {form.carrier && form.carrier !== 'other' && (
                  <p style={{ fontSize: 12, color: 'var(--green-text)', marginTop: 4 }}>
                    ✓ You may receive text message updates
                  </p>
                )}
              </div>
            )}

            {/* Grade / Age */}
            <div className="grid2" style={{ marginBottom: '1rem' }}>
              <div className="field">
                <label>Grade</label>
                <select value={form.grade} onChange={e => set('grade', e.target.value)}>
                  <option value="">Select grade</option>
                  {['6','7','8','9','10','11','12','College/Adult'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Age</label>
                <input type="number" min="8" max="100" value={form.age} onChange={e => set('age', e.target.value)} />
              </div>
            </div>

            {/* Experience */}
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label>Theater experience</label>
              <textarea rows={3} value={form.experience} onChange={e => set('experience', e.target.value)}
                placeholder="List any previous shows, roles, or training…" />
            </div>

            {/* Conflicts */}
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label>Schedule conflicts</label>
              <textarea rows={2} value={form.conflicts} onChange={e => set('conflicts', e.target.value)}
                placeholder="List any dates you cannot attend rehearsals or performances…" />
            </div>

            {/* Custom questions */}
            {(formConfig.auditionQuestions || []).map((q, i) => (
              <div key={i} className="field" style={{ marginBottom: '1rem' }}>
                <label>{q}</label>
                <textarea rows={2} value={form.customAnswers[q] || ''}
                  onChange={e => setCustom(q, e.target.value)} />
              </div>
            ))}

            {/* Headshot */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Headshot photo <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional — staff can add later)</span>
              </label>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
              {!photo ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={openCamera}
                    style={{ fontSize: 14, padding: '10px 14px' }}>📷 Take photo</button>
                  <button type="button" className="btn btn-sm" onClick={() => photoRef.current?.click()}
                    style={{ fontSize: 14, padding: '10px 14px' }}>🖼 Upload photo</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={photo.preview} alt="headshot" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border)' }} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--green-text)', fontWeight: 500, marginBottom: 4 }}>✓ Photo added</p>
                    <button type="button" className="btn btn-sm" onClick={() => setPhoto(null)} style={{ fontSize: 12 }}>Remove</button>
                  </div>
                </div>
              )}
            </div>

            {error && <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>{error}</p>}

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting || !form.firstName || !form.lastName}>
              {submitting ? 'Submitting…' : 'Submit audition form'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: '1rem' }}>
          Your information is only shared with the production team.
        </p>
      </div>

      {cameraOpen && !cameraStream && (
        <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          📷 Requesting camera access…
        </div>
      )}

    </div>
  )
}
