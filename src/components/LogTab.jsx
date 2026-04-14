import { useState, useRef, useEffect } from 'react'
import { api } from '../lib/api'
import { parseHashtags, getHashtagSuggestions } from '../lib/hashtags'

const QUICK_TEMPLATES = [
  { label: 'Late entrance', category: 'blocking', priority: 'med', text: 'Late entrance — check blocking' },
  { label: 'Missed cue', category: 'technical', priority: 'high', text: 'Missed cue' },
  { label: 'Wrong blocking', category: 'blocking', priority: 'med', text: 'Wrong blocking — review staging' },
  { label: 'Off book', category: 'performance', priority: 'high', text: 'Not off book — needs to be off book' },
  { label: 'Tempo', category: 'music', priority: 'med', text: 'Tempo issue — dragging' },
  { label: 'Projection', category: 'performance', priority: 'med', text: 'Needs more projection' },
  { label: 'Energy', category: 'performance', priority: 'med', text: 'Energy drop — push through' },
  { label: 'Props', category: 'set', priority: 'med', text: 'Props issue — check preset' },
  { label: 'Costume', category: 'costume', priority: 'med', text: 'Costume issue — check with wardrobe' },
  { label: 'Lights', category: 'technical', priority: 'high', text: 'Lighting cue missed or wrong' },
  { label: 'Sound', category: 'technical', priority: 'high', text: 'Sound issue — check levels/cue' },
  { label: 'Set preset', category: 'set', priority: 'med', text: 'Set piece or prop not preset correctly' },
]

function useVoiceInput(onResult) {
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  const recogRef = useRef(null)

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false; r.interimResults = false; r.lang = 'en-US'
    r.onresult = (e) => { onResult(e.results[0][0].transcript); setListening(false) }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    recogRef.current = r; r.start(); setListening(true)
  }
  function stop() { recogRef.current?.stop(); setListening(false) }
  return { listening, supported, start, stop }
}

export default function LogTab({ sheetId, scenes, characters, swDisplay, swRunning, createdBy, onNoteAdded, attachFolderId }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today, scene: '', category: 'general', priority: 'med',
    cast: '', castList: [], cue: '', text: '', carriedOver: false, privateNote: false
  })
  const [flash, setFlash] = useState(false)
  const [photo, setPhoto] = useState(null) // { base64, mimeType, name, preview }
  const photoInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [parsedTags, setParsedTags] = useState([])
  const textareaRef = useRef(null)

  // Pick up prefill from calendar "Log notes for this rehearsal"
  useEffect(() => {
    const raw = sessionStorage.getItem('rn_prefill')
    if (raw) {
      try {
        const { date, scene } = JSON.parse(raw)
        if (date) set('date', date)
        if (scene) set('scene', scene)
        sessionStorage.removeItem('rn_prefill')
      } catch {}
    }
  }, [])

  const voice = useVoiceInput((text) => {
    const newText = form.text ? form.text + ' ' + text : text
    handleTextChange(newText)
  })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function handleTextChange(text) {
    set('text', text)
    // Live hashtag parsing — update fields as user types
    const parsed = parseHashtags(text, characters, scenes)
    setParsedTags(parsed.tags)
    if (parsed.category) set('category', parsed.category)
    if (parsed.priority) set('priority', parsed.priority)
    if (parsed.cast) set('cast', parsed.cast)
    if (parsed.scene) set('scene', parsed.scene)
    // Suggestions for current incomplete tag
    setSuggestions(getHashtagSuggestions(text, characters, scenes))
  }

  function applySuggestion(suggestion) {
    // Replace the current incomplete hashtag with the suggestion
    const newText = form.text.replace(/#([a-zA-Z0-9_]*)$/, suggestion)
    handleTextChange(newText + ' ')
    setSuggestions([])
    textareaRef.current?.focus()
  }

  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    // Compress image client-side
    const preview = URL.createObjectURL(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      // Simple compression via canvas
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
        setPhoto({ base64: compressed, mimeType: 'image/jpeg', name: file.name, preview })
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  function applyTemplate(t) {
    setForm(f => ({ ...f, category: t.category, priority: t.priority, text: t.text }))
    setParsedTags([])
    setSuggestions([])
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function submit(e) {
    e.preventDefault()
    if (!form.text.trim()) return

    // Final parse to clean hashtags from saved text
    const parsed = parseHashtags(form.text, characters, scenes)
    const finalText = parsed.cleanText || form.text

    const swTime = swRunning ? `@ ${swDisplay}` : ''
    const tempId = 'tmp_' + Date.now()
    const now = new Date()
    const finalForm = {
      ...form,
      text: finalText,
      category: parsed.category || form.category,
      priority: parsed.priority || form.priority,
      cast: parsed.cast || form.cast,
      castList: parsed.cast ? parsed.cast.split(',').map(s => s.trim()).filter(Boolean) : form.castList,
      scene: parsed.scene || form.scene,
    }
    const fullNote = {
      ...finalForm, swTime, createdBy, id: tempId,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
      resolved: false,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    onNoteAdded(fullNote)
    setForm(f => ({ ...f, text: '', cast: '', castList: [], cue: '', carriedOver: false, privateNote: false, scene: '', category: 'general', priority: 'med' }))
    setPhoto(null)
    setParsedTags([])
    setSuggestions([])
    setFlash(true)
    setTimeout(() => setFlash(false), 1500)
    api.saveNote(sheetId, { ...finalForm, swTime, createdBy })
      .then(async result => {
        let attachmentUrl = ''
        if (photo && attachFolderId) {
          try {
            const uploaded = await api.uploadFile({
              folderId: attachFolderId,
              fileName: 'note-' + result.id + '.jpg',
              mimeType: 'image/jpeg',
              base64Data: photo.base64,
              category: 'note-attachment'
            })
            attachmentUrl = uploaded.webViewLink || ''
            await api.updateNote(sheetId, result.id, { attachmentUrl })
          } catch (e) { console.warn('Photo upload failed:', e.message) }
        }
        onNoteAdded({ ...fullNote, id: result.id, createdAt: result.createdAt, attachmentUrl })
        setPhoto(null)
      })
      .catch(e => console.warn('Note sync failed:', e.message))
  }

  const dtLabel = (() => {
    const dt = new Date(form.date + 'T00:00:00')
    return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  })()

  return (
    <div>
      {/* Quick templates */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 500 }}>Quick templates</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, WebkitOverflowScrolling: 'touch' }}>
          {QUICK_TEMPLATES.map(t => (
            <button key={t.label} type="button" className="btn btn-sm"
              onClick={() => applyTemplate(t)} style={{ fontSize: 12 }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <form onSubmit={submit}>
          {/* Date row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Rehearsal date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div style={{ fontSize: 12, padding: '5px 12px', background: 'var(--blue-bg)', color: 'var(--blue-text)', borderRadius: 20, fontWeight: 500, alignSelf: 'flex-end', marginBottom: 1 }}>{dtLabel}</div>
            {swRunning && (
              <div style={{ fontSize: 12, padding: '5px 12px', background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 20, fontWeight: 500, alignSelf: 'flex-end', marginBottom: 1 }}>@ {swDisplay}</div>
            )}
          </div>

          {/* Category / priority / scene — auto-filled by hashtags */}
          <div className="grid3" style={{ marginBottom: '0.75rem' }}>
            <div className="field">
              <label>Scene {parsedTags.some(t => scenes.some(s => s.toLowerCase().includes(t.slice(1).toLowerCase()))) && <span style={{ color: 'var(--blue-text)', fontSize: 11 }}>● auto</span>}</label>
              <select value={form.scene} onChange={e => set('scene', e.target.value)}>
                <option value="">— none —</option>
                {scenes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Category {parsedTags.length > 0 && form.category !== 'general' && <span style={{ color: 'var(--blue-text)', fontSize: 11 }}>● auto</span>}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[['general','General'],['blocking','Blocking'],['performance','Performance'],['music','Music / vocals'],['technical','Technical'],['costume','Costume'],['set','Set / props'],['choreography','Choreography'],['orchestra','Orchestra']].map(([val, label]) => {
                  const cats = form.category ? form.category.split(',').map(s => s.trim()) : ['general']
                  const active = cats.includes(val)
                  return (
                    <button key={val} type="button"
                      onClick={() => {
                        let cats = form.category ? form.category.split(',').map(s => s.trim()).filter(Boolean) : []
                        if (val === 'general') { set('category', 'general'); return }
                        if (active) { cats = cats.filter(c => c !== val); if (!cats.length) cats = ['general'] }
                        else { cats = cats.filter(c => c !== 'general'); cats.push(val) }
                        set('category', cats.join(', '))
                      }}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontWeight: active ? 600 : 400,
                        background: active ? 'var(--accent, #6d28d9)' : 'var(--bg2)',
                        color: active ? 'white' : 'var(--text2)',
                        border: `0.5px solid ${active ? 'transparent' : 'var(--border)'}` }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="field">
              <label>Priority {parsedTags.some(t => ['#high','#low','#urgent','#critical','#minor','#polish'].includes(t)) && <span style={{ color: 'var(--blue-text)', fontSize: 11 }}>● auto</span>}</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="high">High — fix tonight</option>
                <option value="med">Normal</option>
                <option value="low">Low — polish later</option>
              </select>
            </div>
          </div>

          {/* Cast / cue */}
          <div className="grid2" style={{ marginBottom: '0.75rem' }}>
            <div className="field">
              <label>Cast members {parsedTags.length > 0 && form.castList.length > 0 && <span style={{ color: 'var(--blue-text)', fontSize: 11 }}>● auto</span>}</label>
              {/* Selected pills */}
              {form.castList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {form.castList.map(name => (
                    <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px', background: 'var(--blue-bg)', color: 'var(--blue-text)', border: '0.5px solid var(--blue-text)', borderRadius: 20 }}>
                      {name}
                      <button type="button" onClick={() => { const next = form.castList.filter(n => n !== name); set('castList', next); set('cast', next.join(', ')) }} style={{ background: 'none', border: 'none', color: 'var(--blue-text)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <select value="" onChange={e => {
                if (!e.target.value) return
                const next = form.castList.includes(e.target.value) ? form.castList : [...form.castList, e.target.value]
                set('castList', next)
                set('cast', next.join(', '))
                e.target.value = ''
              }}>
                <option value="">+ Add cast member…</option>
                {characters.filter(c => !form.castList.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cue / reference</label>
              <input type="text" value={form.cue} onChange={e => set('cue', e.target.value)} placeholder="measure 34, page 18…" />
            </div>
          </div>

          {/* Note textarea with voice + hashtag suggestions */}
          <div className="field" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ marginBottom: 0 }}>Note — use #tags to auto-fill fields</label>
              {voice.supported && (
                <button type="button" onClick={voice.listening ? voice.stop : voice.start}
                  style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 20,
                    border: '0.5px solid ' + (voice.listening ? 'var(--red-text)' : 'var(--border2)'),
                    background: voice.listening ? 'var(--red-bg)' : 'transparent',
                    color: voice.listening ? 'var(--red-text)' : 'var(--text2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                  }}>
                  <span style={{ fontSize: 10 }}>{voice.listening ? '⏹' : '🎙'}</span>
                  {voice.listening ? 'Listening…' : 'Voice input'}
                </button>
              )}
            </div>
            <textarea
              ref={textareaRef}
              rows={3}
              value={form.text}
              onChange={e => handleTextChange(e.target.value)}
              placeholder={'e.g. #olive watch the spelling card timing #blocking measure 14'}
              style={{ borderColor: voice.listening ? 'var(--red-text)' : suggestions.length ? 'var(--blue-text)' : undefined }}
            />

            {/* Hashtag suggestions dropdown */}
            {suggestions.length > 0 && (
              <div style={{
                background: 'var(--bg)', border: '0.5px solid var(--border2)',
                borderRadius: 'var(--radius)', marginTop: 4,
                display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px'
              }}>
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => applySuggestion(s)}
                    style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 20,
                      background: 'var(--blue-bg)', color: 'var(--blue-text)',
                      border: '0.5px solid transparent', cursor: 'pointer', fontWeight: 500
                    }}>{s}</button>
                ))}
              </div>
            )}

            {/* Parsed tags preview */}
            {parsedTags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Detected:</span>
                {parsedTags.map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 20,
                    background: 'var(--blue-bg)', color: 'var(--blue-text)'
                  }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Photo attachment */}
          <div style={{ marginBottom: '0.75rem' }}>
            <input ref={photoInputRef} type="file" accept="image/*"
              onChange={handlePhoto} style={{ display: 'none' }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhoto} style={{ display: 'none' }} />
            {!photo ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => cameraInputRef.current?.click()}
                  style={{ fontSize: 14, padding: '10px 14px' }}>
                  📷 Camera
                </button>
                <button type="button" className="btn btn-sm" onClick={() => photoInputRef.current?.click()}
                  style={{ fontSize: 14, padding: '10px 14px' }}>
                  🖼 Library
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={photo.preview} alt="attachment"
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)' }} />
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{photo.name}</p>
                  <button type="button" className="btn btn-sm" onClick={() => setPhoto(null)}
                    style={{ fontSize: 11, color: 'var(--red-text)', borderColor: 'var(--red-text)' }}>Remove</button>
                </div>
              </div>
            )}
          </div>

          {/* Carried over */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
            <input type="checkbox" id="carried-over" checked={form.carriedOver}
              onChange={e => set('carriedOver', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="carried-over" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', marginBottom: 0 }}>
              Carried over from previous rehearsal
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
            <input type="checkbox" id="private-note" checked={form.privateNote}
              onChange={e => set('privateNote', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="private-note" style={{ fontSize: 13, color: 'var(--purple-text)', cursor: 'pointer', marginBottom: 0, fontWeight: 500 }}>
              🔒 Private — don't share with cast
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={!form.text.trim()}>
            {flash ? '✓ Note logged' : '+ Add note'}
          </button>
        </form>
      </div>

      {/* Hashtag reference */}
      <div style={{ marginTop: '1rem', padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.8 }}>
        <span style={{ fontWeight: 500, color: 'var(--text2)' }}>Hashtag shortcuts: </span>
        #blocking #performance #music #technical #costume #set · #high #low · #[cast name] · #[scene name]
      </div>
    </div>
  )
}
