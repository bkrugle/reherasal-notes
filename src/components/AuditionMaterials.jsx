import { useState } from 'react'
import { api } from '../lib/api'

const TYPES = [
  { value: 'sides', label: 'Audition sides', icon: '📄', desc: 'Scenes from the show to use at auditions' },
  { value: 'monologues', label: 'Monologue suggestions', icon: '🎭', desc: 'Contrasting monologues from other shows' },
  { value: 'vocal', label: 'Vocal guidance', icon: '🎵', desc: 'Ranges, 16-bar cuts, what to listen for' },
  { value: 'schedule', label: 'Audition schedule', icon: '📅', desc: 'Day-of schedule template and prep checklist' },
]

export default function AuditionMaterials({ showTitle }) {
  const [selected, setSelected] = useState('sides')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState({})
  const [error, setError] = useState('')

  async function generate() {
    if (!showTitle) { setError('Enter a show title in Setup → Details first'); return }
    setLoading(true)
    setError('')
    try {
      const data = await api.generateAuditionMaterials(showTitle, selected)
      setResults(r => ({ ...r, [selected]: data.content }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const current = results[selected]

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.6 }}>
        Use AI to help prepare audition materials for <strong>{showTitle || 'your show'}</strong>.
        Each type is generated fresh using Claude.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: '1.25rem' }}>
        {TYPES.map(t => (
          <div key={t.value} onClick={() => setSelected(t.value)}
            style={{
              padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'center',
              border: selected === t.value ? '2px solid var(--text)' : '0.5px solid var(--border)',
              background: selected === t.value ? 'var(--bg2)' : 'var(--bg)'
            }}>
            <p style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</p>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{t.label}</p>
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>{t.desc}</p>
            {results[t.value] && <p style={{ fontSize: 11, color: 'var(--green-text)', marginTop: 4 }}>✓ Generated</p>}
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={generate} disabled={loading || !showTitle}>
        {loading ? 'Generating…' : current ? '↻ Regenerate' : `Generate ${TYPES.find(t => t.value === selected)?.label}`}
      </button>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginTop: '1rem' }}>
          {error}
        </p>
      )}

      {current && (
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 500, overflowY: 'auto' }}>
          {current}
        </div>
      )}
    </div>
  )
}
