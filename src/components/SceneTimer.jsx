import { useState, useEffect, useRef } from 'react'

const SCENES_DEFAULT = []

export default function SceneTimer({ scenes }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [currentScene, setCurrentScene] = useState('')
  const [laps, setLaps] = useState([]) // { scene, duration, target }
  const [targets, setTargets] = useState({}) // scene -> minutes
  const [editingTargets, setEditingTargets] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime)
      }, 500)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, startTime])

  function start() {
    setStartTime(Date.now())
    setRunning(true)
    setElapsed(0)
  }

  function stop() {
    setRunning(false)
    clearInterval(intervalRef.current)
  }

  function reset() {
    stop()
    setElapsed(0)
    setLaps([])
  }

  function logScene() {
    if (!currentScene || !running) return
    const duration = elapsed
    const targetMs = targets[currentScene] ? targets[currentScene] * 60000 : null
    setLaps(l => [...l, { scene: currentScene, duration, target: targetMs, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    // Reset timer for next scene
    setStartTime(Date.now())
    setElapsed(0)
  }

  function fmt(ms) {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return m + ':' + (s < 10 ? '0' : '') + s
  }

  function fmtDiff(duration, target) {
    if (!target) return null
    const diff = duration - target
    const abs = Math.abs(diff)
    const sign = diff > 0 ? '+' : '-'
    return sign + fmt(abs)
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Scene timer</span>
        <button className="btn btn-sm" onClick={() => setEditingTargets(e => !e)}>
          {editingTargets ? 'Done' : 'Set targets'}
        </button>
      </div>

      {editingTargets && scenes.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius)' }}>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Target running time (minutes) per scene</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scenes.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, flex: 1, color: 'var(--text)' }}>{s}</span>
                <input type="number" min="0" max="120"
                  value={targets[s] || ''}
                  onChange={e => setTargets(t => ({ ...t, [s]: e.target.value }))}
                  placeholder="min"
                  style={{ width: 64, padding: '4px 8px', fontSize: 13 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timer display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 600, color: running ? '#e24b4a' : 'var(--text)', minWidth: 80 }}>
          {fmt(elapsed)}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {!running
            ? <button className="btn btn-sm btn-primary" onClick={start}>Start</button>
            : <button className="btn btn-sm" onClick={stop}>Pause</button>}
          <button className="btn btn-sm" onClick={reset}>Reset</button>
        </div>
      </div>

      {/* Scene selector + log */}
      {running && (
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          <select value={currentScene} onChange={e => setCurrentScene(e.target.value)} style={{ flex: 1 }}>
            <option value="">— select scene —</option>
            {scenes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-sm" onClick={logScene} disabled={!currentScene}
            style={{ whiteSpace: 'nowrap' }}>
            Log scene
          </button>
        </div>
      )}

      {/* Lap history */}
      {laps.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>Scene times</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {laps.map((lap, i) => {
              const diff = fmtDiff(lap.duration, lap.target)
              const over = lap.target && lap.duration > lap.target
              const under = lap.target && lap.duration < lap.target
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ color: 'var(--text)' }}>{lap.scene}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{fmt(lap.duration)}</span>
                    {diff && (
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: over ? 'var(--red-bg)' : 'var(--green-bg)', color: over ? 'var(--red-text)' : 'var(--green-text)' }}>
                        {diff}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{lap.time}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
