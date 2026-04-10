import { useState, useRef } from 'react'
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

export default function LogTab({ sheetId, scenes, characters, swDisplay, swRunning, createdBy, onNoteAdded }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today, scene: '', category: 'general', priority: 'med',
    cast: '', cue: '', text: '', carriedOver: false
  })
  const [flash, setFlash] = useState(false)
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
      scene: parsed.scene || form.scene,
    }
    const fullNote = {
      ...finalForm, swTime, createdBy, id: tempId,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
      resolved: false,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    onNoteAdded(fullNote)
    setForm(f => ({ ...f, text: '', cast: '', cue: '', carriedOver: false, scene: '', category: 'general', priority: 'med' }))
    setParsedTags([])
    setSuggestions([])
    setFlash(true)
    setTimeout(() => setFlash(false), 1500)
    api.saveNote(sheetId, { ...finalForm, swTime, createdBy })
      .then(result => onNoteAdded({ ...fullNote, id: result.id, createdAt: result.createdAt }))
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="general">General</option>
                <option value="blocking">Blocking</option>
                <option value="performance">Performance</option>
                <option value="music">Music / vocals</option>
                <option value="technical">Technical</option>
                <option value="costume">Costume</option>
                <option value="set">Set / props</option>
              </select>
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
              <label>Cast member {parsedTags.length > 0 && form.cast && <span style={{ color: 'var(--blue-text)', fontSize: 11 }}>● auto</span>}</label>
              <input type="text" value={form.cast} onChange={e => set('cast', e.target.value)}
                placeholder="Name or character… or #name" list="log-cast-list" autoComplete="off" />
              <datalist id="log-cast-list">
                {characters.map(c => <option key={c} value={c} />)}
              </datalist>
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

          {/* Carried over */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
            <input type="checkbox" id="carried-over" checked={form.carriedOver}
              onChange={e => set('carriedOver', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="carried-over" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', marginBottom: 0 }}>
              Carried over from previous rehearsal
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
