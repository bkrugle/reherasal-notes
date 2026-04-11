import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const STEPS = ['Production details', 'Scenes', 'Characters', 'Auditions', 'Access']

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '2rem' }}>
      {STEPS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
          {/* Step bubble + label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, width: 64 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i <= current ? 'var(--text)' : 'var(--bg3)',
              border: '0.5px solid ' + (i <= current ? 'transparent' : 'var(--border2)'),
              color: i <= current ? 'var(--bg)' : 'var(--text3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600
            }}>{i < current ? '✓' : i + 1}</div>
            <span style={{ fontSize: 10, color: i === current ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap', fontWeight: i === current ? 500 : 400, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
          </div>
          {/* Connector line between steps */}
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: '0.5px', background: i < current ? 'var(--text)' : 'var(--border2)', margin: '0 2px', marginTop: 14 }} />
          )}
        </div>
      ))}
    </div>
  )
}

function TagInput({ label, placeholder, values, onChange, hint }) {
  const [input, setInput] = useState('')
  function add() {
    const items = input.split(',').map(v => v.trim()).filter(Boolean)
    if (!items.length) return
    const unique = items.filter(v => !values.includes(v))
    if (unique.length) onChange([...values, ...unique])
    setInput('')
  }
  function remove(v) { onChange(values.filter(x => x !== v)) }
  return (
    <div className="field" style={{ marginBottom: '1rem' }}>
      <label>{label}</label>
      {hint && <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{hint}</p>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
        />
        <button type="button" className="btn" onClick={add} style={{ flexShrink: 0 }}>Add</button>
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {values.map(v => (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '3px 10px',
              background: 'var(--bg2)', border: '0.5px solid var(--border)',
              borderRadius: 20, color: 'var(--text)'
            }}>
              {v}
              <button type="button" onClick={() => remove(v)} style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0
              }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CreatePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [lookingUpCast, setLookingUpCast] = useState(false)
  const [castLookupResult, setCastLookupResult] = useState(null)
  const [lookingUpScenes, setLookingUpScenes] = useState(false)
  const [sceneLookupResult, setSceneLookupResult] = useState(null)

  const [form, setForm] = useState({
    title: '',
    directorName: '',
    directorEmail: '',
    showDates: '',
    venue: '',
    scenes: [],
    characters: [],
    staff: [],
    pin: '',
    pinConfirm: '',
    adminPin: '',
    adminPinConfirm: ''
  })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function lookupCast() {
    if (!form.title) return
    setLookingUpCast(true)
    setCastLookupResult(null)
    try {
      const data = await api.lookupShowCast(form.title)
      if (data.characters?.length > 0) setCastLookupResult(data)
    } catch (e) { console.warn('Cast lookup failed:', e.message) }
    finally { setLookingUpCast(false) }
  }

  async function lookupScenes() {
    if (!form.title) return
    setLookingUpScenes(true)
    setSceneLookupResult(null)
    try {
      const data = await api.lookupShowScenes(form.title)
      if (data.scenes?.length > 0) setSceneLookupResult(data)
    } catch (e) { console.warn('Scene lookup failed:', e.message) }
    finally { setLookingUpScenes(false) }
  }

  function validateStep() {
    if (step === 0) {
      if (!form.title.trim()) return 'Production title is required'
      if (!form.directorName.trim()) return 'Director name is required'
    }
    if (step === 4) {
      if (!form.pin || form.pin.length < 4) return 'PIN must be at least 4 characters'
      if (form.pin !== form.pinConfirm) return 'PINs do not match'
      if (form.adminPin && form.adminPin !== form.adminPinConfirm) return 'Admin PINs do not match'
    }
    return null
  }

  function next() {
    const e = validateStep()
    if (e) { setError(e); return }
    setError('')
    setStep(s => s + 1)
  }

  function back() { setError(''); setStep(s => s - 1) }

  async function submit() {
    const e = validateStep()
    if (e) { setError(e); return }
    setLoading(true)
    setError('')
    try {
      const data = await api.createProduction({
        title: form.title.trim(),
        directorName: form.directorName.trim(),
        directorEmail: form.directorEmail.trim(),
        showDates: form.showDates.trim(),
        venue: form.venue.trim(),
        scenes: form.scenes,
        characters: form.characters,
        staff: form.staff,
        pin: form.pin,
        adminPin: form.adminPin || form.pin,
        useAuditions: form.useAuditions
      })
      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed to create production')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Production created!</h2>
          <p className="muted" style={{ marginBottom: '1.5rem' }}>Share this code and PIN with your team.</p>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>Production code</p>
              <p style={{ fontSize: 36, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text)' }}>{result.productionCode}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>PIN</p>
              <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text)' }}>{form.pin}</p>
            </div>
            {form.adminPin && form.adminPin !== form.pin && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '0.5px solid var(--border)' }}>
                <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>Admin PIN (keep private)</p>
                <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text)' }}>{form.adminPin}</p>
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1.5rem' }}>
            Write these down — the PIN cannot be recovered if lost.
          </p>
          <button className="btn btn-primary btn-full" onClick={() => navigate('/')}>
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <button className="btn btn-sm" onClick={() => navigate('/')}>← Back</button>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>New production</h1>
        </div>

        <StepIndicator current={step} />

        <div className="card">
          {/* Step 0: Details */}
          {step === 0 && (
            <>
              <div className="field" style={{ marginBottom: '1rem' }}>
                <label>Production title *</label>
                <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Into the Woods, Spring 2026" />
              </div>
              <div className="grid2" style={{ marginBottom: '1rem' }}>
                <div className="field">
                  <label>Director name *</label>
                  <input type="text" value={form.directorName} onChange={e => set('directorName', e.target.value)} placeholder="Your name" />
                </div>
                <div className="field">
                  <label>Director email</label>
                  <input type="email" value={form.directorEmail} onChange={e => set('directorEmail', e.target.value)} placeholder="you@school.edu" />
                </div>
              </div>
              <div className="grid2" style={{ marginBottom: '1rem' }}>
                <div className="field">
                  <label>Show dates</label>
                  <input type="text" value={form.showDates} onChange={e => set('showDates', e.target.value)} placeholder="May 1–4, 2026" />
                </div>
                <div className="field">
                  <label>Venue</label>
                  <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="Valley High Auditorium" />
                </div>
              </div>
            </>
          )}

          {/* Step 1: Scenes */}
          {step === 1 && (
            <>
              {form.title && (
                <div style={{ marginBottom: '1rem' }}>
                  {sceneLookupResult ? (
                    <div style={{ background: 'var(--blue-bg)', border: '0.5px solid var(--blue-text)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--blue-text)', marginBottom: 8 }}>
                        ✨ Found {sceneLookupResult.scenes.length} scenes for <em>{sceneLookupResult.showTitle}</em>
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {sceneLookupResult.scenes.map(name => {
                          const added = form.scenes.includes(name)
                          return (
                            <button key={name} type="button"
                              onClick={() => {
                                if (added) set('scenes', form.scenes.filter(s => s !== name))
                                else set('scenes', [...form.scenes, name])
                              }}
                              style={{
                                fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                                border: '0.5px solid var(--blue-text)',
                                background: added ? 'var(--blue-text)' : 'transparent',
                                color: added ? 'var(--bg)' : 'var(--blue-text)'
                              }}>
                              {added ? '✓ ' : ''}{name}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-sm"
                          onClick={() => set('scenes', [...new Set([...form.scenes, ...sceneLookupResult.scenes])])}>
                          Add all
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setSceneLookupResult(null)}>Dismiss</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={lookupScenes} disabled={lookingUpScenes}
                      style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', borderColor: 'transparent', fontWeight: 500 }}>
                      {lookingUpScenes ? '✨ Looking up scenes…' : `✨ Auto-populate scenes from "${form.title}"`}
                    </button>
                  )}
                </div>
              )}
              <p className="muted" style={{ marginBottom: '1rem' }}>Add your scenes or acts. These will appear in the note logging dropdown.</p>
              <TagInput
                label="Scenes / acts"
                placeholder="e.g. Act 1 Scene 2, Opening Number"
                values={form.scenes}
                onChange={v => set('scenes', v)}
                hint="Separate multiple entries with commas, or press Enter after each"
              />
              <div style={{ marginTop: '0.5rem', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)' }}>
                Tip: You can also add scenes like "Full run", "Bows", "Pit rehearsal" — whatever you actually call them.
              </div>
            </>
          )}

          {/* Step 2: Characters */}
          {step === 2 && (
            <>
              <p className="muted" style={{ marginBottom: '1rem' }}>Add your cast members and characters. These appear in the cast member autocomplete when logging notes.</p>

              {/* Auto-populate from show title */}
              {form.title && (
                <div style={{ marginBottom: '1rem' }}>
                  {castLookupResult ? (
                    <div style={{ background: 'var(--purple-bg)', border: '0.5px solid var(--purple-text)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--purple-text)', marginBottom: 8 }}>
                        ✨ Found {castLookupResult.characters.length} characters for <em>{castLookupResult.showTitle}</em>
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {castLookupResult.characters.map(name => {
                          const added = form.characters.includes(name)
                          return (
                            <button key={name} type="button"
                              onClick={() => {
                                if (added) set('characters', form.characters.filter(c => c !== name))
                                else set('characters', [...form.characters, name])
                              }}
                              style={{
                                fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                                border: '0.5px solid var(--purple-text)',
                                background: added ? 'var(--purple-text)' : 'transparent',
                                color: added ? 'var(--bg)' : 'var(--purple-text)'
                              }}>
                              {added ? '✓ ' : ''}{name}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-sm"
                          onClick={() => set('characters', [...new Set([...form.characters, ...castLookupResult.characters])])}>
                          Add all
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setCastLookupResult(null)}>Dismiss</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={lookupCast} disabled={lookingUpCast}
                      style={{ background: 'var(--purple-bg)', color: 'var(--purple-text)', borderColor: 'transparent', fontWeight: 500 }}>
                      {lookingUpCast ? '✨ Looking up cast…' : `✨ Auto-populate cast from "${form.title}"`}
                    </button>
                  )}
                </div>
              )}

              <TagInput
                label="Cast / characters"
                placeholder="e.g. Elphaba, Ensemble, Wicked Witch u/s"
                values={form.characters}
                onChange={v => set('characters', v)}
                hint="Use actor names, character names, or both — whatever you prefer"
              />
              <TagInput
                label="Staff members"
                placeholder="e.g. Music Director, Stage Manager"
                values={form.staff}
                onChange={v => set('staff', v)}
                hint="Optional — staff who will also log notes"
              />
            </>
          )}

          {/* Step 3: Access */}
          {step === 3 && (
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 48, marginBottom: '0.75rem' }}>🎭</div>
            <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Include audition management?</p>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
              This enables a public audition form, auditioner profiles with headshots,
              staff notes, AI preparation materials, and role assignment.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.5rem' }}>
            <div onClick={() => set('useAuditions', true)}
              style={{
                padding: '1.25rem', borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'center',
                border: form.useAuditions ? '2px solid var(--text)' : '0.5px solid var(--border)',
                background: form.useAuditions ? 'var(--bg2)' : 'var(--bg)'
              }}>
              <p style={{ fontSize: 22, marginBottom: 6 }}>✓</p>
              <p style={{ fontSize: 14, fontWeight: 500 }}>Yes, include auditions</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Creates audition form, sheets, and folders</p>
            </div>
            <div onClick={() => set('useAuditions', false)}
              style={{
                padding: '1.25rem', borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'center',
                border: !form.useAuditions ? '2px solid var(--text)' : '0.5px solid var(--border)',
                background: !form.useAuditions ? 'var(--bg2)' : 'var(--bg)'
              }}>
              <p style={{ fontSize: 22, marginBottom: 6 }}>→</p>
              <p style={{ fontSize: 14, fontWeight: 500 }}>Skip for now</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Can be enabled later in Setup</p>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
            <>
              <p className="muted" style={{ marginBottom: '1.25rem' }}>
                Set a PIN for your team to enter the production. Optionally set a separate admin PIN for yourself — admin access lets you edit production setup and manage team access.
              </p>
              <div className="grid2" style={{ marginBottom: '1rem' }}>
                <div className="field">
                  <label>Team PIN *</label>
                  <input type="password" value={form.pin} onChange={e => set('pin', e.target.value)} placeholder="Min. 4 characters" />
                </div>
                <div className="field">
                  <label>Confirm team PIN *</label>
                  <input type="password" value={form.pinConfirm} onChange={e => set('pinConfirm', e.target.value)} placeholder="Repeat PIN" />
                </div>
              </div>
              <div style={{ height: '0.5px', background: 'var(--border)', margin: '1rem 0' }} />
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: '0.75rem' }}>Admin PIN <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional — defaults to team PIN)</span></p>
              <div className="grid2">
                <div className="field">
                  <label>Admin PIN</label>
                  <input type="password" value={form.adminPin} onChange={e => set('adminPin', e.target.value)} placeholder="Your private PIN" />
                </div>
                <div className="field">
                  <label>Confirm admin PIN</label>
                  <input type="password" value={form.adminPinConfirm} onChange={e => set('adminPinConfirm', e.target.value)} placeholder="Repeat admin PIN" />
                </div>
              </div>
            </>
          )}

          {error && (
            <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginTop: '1rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: 8 }}>
            {step > 0
              ? <button type="button" className="btn" onClick={back}>← Back</button>
              : <div />}
            {step < STEPS.length - 1
              ? <button type="button" className="btn btn-primary" onClick={next}>Continue →</button>
              : <button type="button" className="btn btn-primary" onClick={submit} disabled={loading}>
                  {loading ? 'Creating…' : 'Create production'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
