import { useState, useRef } from 'react'
import {
  newActId, newSceneId, defaultActs,
  ensureMigrated, isLegacyConfig,
  groupScenesByAct,
  addAct as libAddAct,
  renameAct as libRenameAct,
  removeAct as libRemoveAct,
  reorderActs as libReorderActs,
  addScene as libAddScene,
  renameScene as libRenameScene,
  removeScene as libRemoveScene,
  moveSceneToAct as libMoveSceneToAct
} from '../lib/actsScenes'

/**
 * ActsScenesManager
 *
 * Replaces the old flat scenes input with a structured Acts → Scenes manager.
 *
 * Props:
 *   acts        — array of {id, name, order}
 *   scenes      — array of {id, name, actId|null, order}  (the new structured shape)
 *   legacyScenes— OPTIONAL flat string array. If provided AND `scenes` is empty,
 *                 we migrate from legacy on the fly so the user sees their
 *                 existing flat scenes already grouped.
 *   onChange    — called with { acts, scenes } whenever anything changes
 *   onLookup    — optional () => Promise<{acts, scenes_struct}> for ✨ Auto-populate
 *   busy        — disable controls while parent is saving
 */
export default function ActsScenesManager({
  acts: actsProp = [],
  scenes: scenesProp = [],
  legacyScenes = null,
  onChange,
  onLookup = null,
  lookupBusy = false,
  showTitle = ''
}) {
  // Bootstrap: if the parent gave us no acts/structured scenes but DOES have a
  // legacy flat array, migrate it once so the user can edit immediately.
  const initial = (() => {
    if (Array.isArray(actsProp) && actsProp.length > 0) {
      return { acts: actsProp, scenes: scenesProp || [] }
    }
    if (Array.isArray(legacyScenes) && legacyScenes.length > 0) {
      const migrated = ensureMigrated({ scenes: legacyScenes })
      return { acts: migrated.acts, scenes: migrated.scenes }
    }
    return { acts: defaultActs(2), scenes: [] }
  })()

  // We don't store local state — we always reflect parent state. But we DO
  // maintain UI-only state (collapsed acts, "add scene" dialog target, etc).
  const acts   = actsProp.length ? actsProp : initial.acts
  const scenes = (scenesProp.length || actsProp.length) ? scenesProp : initial.scenes

  // If we had to bootstrap defaults, push them back to the parent immediately
  // so subsequent renders agree on the data. Use a ref to fire only once.
  const bootstrappedRef = useRef(false)
  if (!bootstrappedRef.current && (!actsProp.length || (legacyScenes?.length && !scenesProp.length))) {
    bootstrappedRef.current = true
    if (onChange) onChange({ acts: initial.acts, scenes: initial.scenes })
  }

  const [collapsed, setCollapsed] = useState({})
  const [editingActId, setEditingActId] = useState(null)
  const [editingActName, setEditingActName] = useState('')
  const [editingSceneId, setEditingSceneId] = useState(null)
  const [editingSceneName, setEditingSceneName] = useState('')
  const [newSceneInput, setNewSceneInput] = useState({})  // { [actId|'__none']: 'partial text' }
  const [newActName, setNewActName] = useState('')
  const [showLegend, setShowLegend] = useState(false)
  const [moveMenuFor, setMoveMenuFor] = useState(null)   // sceneId showing move-to menu

  function commit(nextActs, nextScenes) {
    onChange && onChange({ acts: nextActs, scenes: nextScenes })
  }

  // ---- act actions --------------------------------------------------------

  function handleAddAct() {
    const name = newActName.trim() || `Act ${acts.length + 1}`
    commit(libAddAct(acts, name), scenes)
    setNewActName('')
  }

  function startEditAct(act) {
    setEditingActId(act.id)
    setEditingActName(act.name)
  }
  function saveEditAct() {
    if (editingActId && editingActName.trim()) {
      commit(libRenameAct(acts, editingActId, editingActName.trim()), scenes)
    }
    setEditingActId(null)
    setEditingActName('')
  }
  function cancelEditAct() {
    setEditingActId(null)
    setEditingActName('')
  }

  function handleRemoveAct(act) {
    const orphans = scenes.filter(s => s.actId === act.id)
    const msg = orphans.length
      ? `Remove "${act.name}"? ${orphans.length} scene${orphans.length === 1 ? '' : 's'} (${orphans.slice(0,3).map(s => s.name).join(', ')}${orphans.length > 3 ? '…' : ''}) will be moved to "Unassigned".`
      : `Remove "${act.name}"?`
    if (!confirm(msg)) return
    const result = libRemoveAct(acts, scenes, act.id)
    commit(result.acts, result.scenes)
  }

  function handleMoveAct(act, direction) {
    const sorted = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
    const i = sorted.findIndex(a => a.id === act.id)
    if (i < 0) return
    const j = direction === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= sorted.length) return
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    commit(libReorderActs(acts, sorted.map(a => a.id)), scenes)
  }

  // ---- scene actions ------------------------------------------------------

  function handleAddSceneTo(actId) {
    const key = actId || '__none'
    const text = (newSceneInput[key] || '').trim()
    if (!text) return
    // Allow comma-separated bulk add
    const items = text.split(',').map(s => s.trim()).filter(Boolean)
    let next = scenes
    items.forEach(name => { next = libAddScene(next, name, actId) })
    commit(acts, next)
    setNewSceneInput(prev => ({ ...prev, [key]: '' }))
  }

  function startEditScene(scene) {
    setEditingSceneId(scene.id)
    setEditingSceneName(scene.name)
  }
  function saveEditScene() {
    if (editingSceneId && editingSceneName.trim()) {
      commit(acts, libRenameScene(scenes, editingSceneId, editingSceneName.trim()))
    }
    setEditingSceneId(null)
    setEditingSceneName('')
  }
  function cancelEditScene() {
    setEditingSceneId(null)
    setEditingSceneName('')
  }

  function handleRemoveScene(scene) {
    if (!confirm(`Remove scene "${scene.name}"?`)) return
    commit(acts, libRemoveScene(scenes, scene.id))
  }

  function handleMoveSceneToAct(sceneId, targetActId) {
    commit(acts, libMoveSceneToAct(scenes, sceneId, targetActId))
    setMoveMenuFor(null)
  }

  // ---- lookup -------------------------------------------------------------

  async function doLookup() {
    if (!onLookup) return
    try {
      const result = await onLookup()
      if (result && Array.isArray(result.acts) && Array.isArray(result.scenes_struct)) {
        commit(result.acts, result.scenes_struct)
      }
    } catch (e) { console.warn('Lookup failed:', e.message) }
  }

  // ---- render -------------------------------------------------------------

  const sortedActs = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
  const groups = groupScenesByAct(acts, scenes)

  return (
    <div>
      {/* Header / actions row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {acts.length} act{acts.length === 1 ? '' : 's'} · {scenes.length} scene{scenes.length === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" onClick={() => setShowLegend(s => !s)}
            style={{ fontSize: 11 }}>
            {showLegend ? '✕ Hide shortcuts' : '⌘ Quick-tag shortcuts'}
          </button>
          {onLookup && (
            <button type="button" className="btn btn-sm" onClick={doLookup} disabled={lookupBusy || !showTitle}
              style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', borderColor: 'transparent', fontWeight: 500, fontSize: 11 }}>
              {lookupBusy ? '✨ Looking up…' : '✨ Auto-populate'}
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div style={{ background: 'var(--purple-bg)', border: '0.5px solid var(--purple-text)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--purple-text)', marginBottom: 6 }}>
            Quick-tag shortcuts (use in note text)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {sortedActs.slice(0, 6).map((a, i) => (
              <span key={a.id} style={{ padding: '2px 8px', background: 'var(--bg)', borderRadius: 12, color: 'var(--purple-text)', border: '0.5px solid var(--purple-text)' }}>
                #a{i + 1} → {a.name}
              </span>
            ))}
            {sortedActs.length === 0 && (
              <span style={{ color: 'var(--purple-text)', opacity: 0.7 }}>Add an act to enable shortcuts</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--purple-text)', opacity: 0.8, marginTop: 6 }}>
            Type <code style={{ fontFamily: 'inherit' }}>#a1</code> in any note to tag it to {sortedActs[0]?.name || 'the first act'}.
          </p>
        </div>
      )}

      {/* Acts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(({ act, scenes: actScenes }) => {
          const isUnassigned = !act
          const collapseKey = act?.id || '__none'
          const isCollapsed = collapsed[collapseKey]
          const actIndex = act ? sortedActs.findIndex(a => a.id === act.id) : -1
          const isFirst = actIndex === 0
          const isLast = actIndex === sortedActs.length - 1
          const inputKey = act?.id || '__none'

          return (
            <div key={collapseKey} style={{
              background: isUnassigned ? 'var(--bg2)' : 'var(--bg)',
              border: `0.5px solid ${isUnassigned ? 'var(--border)' : 'var(--border2)'}`,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden'
            }}>
              {/* Act header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                background: isUnassigned ? 'transparent' : 'var(--bg2)',
                borderBottom: isCollapsed ? 'none' : `0.5px solid var(--border)`
              }}>
                <button type="button"
                  onClick={() => setCollapsed(c => ({ ...c, [collapseKey]: !c[collapseKey] }))}
                  style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 11, padding: '2px 4px', cursor: 'pointer', lineHeight: 1 }}>
                  {isCollapsed ? '▶' : '▼'}
                </button>

                {editingActId === act?.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingActName}
                    onChange={e => setEditingActName(e.target.value)}
                    onBlur={saveEditAct}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); saveEditAct() }
                      if (e.key === 'Escape') cancelEditAct()
                    }}
                    style={{ flex: 1, padding: '4px 8px', fontSize: 14, fontWeight: 600 }}
                  />
                ) : (
                  <span style={{
                    flex: 1, fontSize: 14, fontWeight: 600,
                    color: isUnassigned ? 'var(--text2)' : 'var(--text)',
                    fontStyle: isUnassigned ? 'italic' : 'normal'
                  }}>
                    {act ? act.name : 'Unassigned'}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>
                      ({actScenes.length})
                    </span>
                  </span>
                )}

                {/* Act controls */}
                {act && editingActId !== act.id && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button type="button" title="Move up" onClick={() => handleMoveAct(act, 'up')} disabled={isFirst}
                      style={{ background: 'none', border: 'none', color: isFirst ? 'var(--border2)' : 'var(--text3)', cursor: isFirst ? 'default' : 'pointer', padding: '2px 5px', fontSize: 11 }}>▲</button>
                    <button type="button" title="Move down" onClick={() => handleMoveAct(act, 'down')} disabled={isLast}
                      style={{ background: 'none', border: 'none', color: isLast ? 'var(--border2)' : 'var(--text3)', cursor: isLast ? 'default' : 'pointer', padding: '2px 5px', fontSize: 11 }}>▼</button>
                    <button type="button" title="Rename" onClick={() => startEditAct(act)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 6px', fontSize: 12 }}>✎</button>
                    <button type="button" title="Remove act" onClick={() => handleRemoveAct(act)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 6px', fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                )}
              </div>

              {/* Act body — scenes list */}
              {!isCollapsed && (
                <div style={{ padding: '8px 12px 12px' }}>
                  {actScenes.length === 0 && !isUnassigned && (
                    <p style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', margin: '4px 0 8px' }}>
                      No scenes yet — add one below.
                    </p>
                  )}

                  {actScenes.map(scene => (
                    <SceneRow key={scene.id}
                      scene={scene}
                      acts={sortedActs}
                      currentActId={act?.id || null}
                      isEditing={editingSceneId === scene.id}
                      editingName={editingSceneName}
                      setEditingName={setEditingSceneName}
                      moveMenuOpen={moveMenuFor === scene.id}
                      onStartEdit={() => startEditScene(scene)}
                      onSaveEdit={saveEditScene}
                      onCancelEdit={cancelEditScene}
                      onRemove={() => handleRemoveScene(scene)}
                      onOpenMoveMenu={() => setMoveMenuFor(moveMenuFor === scene.id ? null : scene.id)}
                      onMoveTo={(targetActId) => handleMoveSceneToAct(scene.id, targetActId)}
                    />
                  ))}

                  {/* Add scene input */}
                  <div style={{ display: 'flex', gap: 6, marginTop: actScenes.length ? 8 : 0 }}>
                    <input type="text"
                      value={newSceneInput[inputKey] || ''}
                      onChange={e => setNewSceneInput(p => ({ ...p, [inputKey]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSceneTo(act?.id || null) } }}
                      placeholder={isUnassigned ? 'Add to unassigned…' : `Add scene to ${act.name}…`}
                      style={{ flex: 1, fontSize: 13, padding: '5px 9px' }}
                    />
                    <button type="button" className="btn btn-sm" onClick={() => handleAddSceneTo(act?.id || null)}
                      style={{ fontSize: 12 }}>+ Add</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add act row */}
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '0.5px dashed var(--border2)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text"
            value={newActName}
            onChange={e => setNewActName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAct() } }}
            placeholder={`New act name (e.g. "Act ${acts.length + 1}", "Prologue", "Part Two")`}
            style={{ flex: 1, fontSize: 13, padding: '5px 9px' }}
          />
          <button type="button" className="btn btn-sm" onClick={handleAddAct} style={{ fontSize: 12 }}>+ Add act</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          Tip: act names can be anything — "Prologue", "Part One", "The Gathering" — not just numbered acts.
        </p>
      </div>
    </div>
  )
}

// ---------- SceneRow ---------------------------------------------------------

function SceneRow({
  scene, acts, currentActId,
  isEditing, editingName, setEditingName,
  moveMenuOpen,
  onStartEdit, onSaveEdit, onCancelEdit, onRemove,
  onOpenMoveMenu, onMoveTo
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 8px',
      background: 'var(--bg)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius)',
      marginBottom: 4,
      position: 'relative'
    }}>
      <span style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        ·
      </span>

      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={editingName}
          onChange={e => setEditingName(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onSaveEdit() }
            if (e.key === 'Escape') onCancelEdit()
          }}
          style={{ flex: 1, padding: '3px 7px', fontSize: 13 }}
        />
      ) : (
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{scene.name}</span>
      )}

      {!isEditing && (
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" title="Move to another act" onClick={onOpenMoveMenu}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 6px', fontSize: 12 }}>↪</button>
          <button type="button" title="Rename" onClick={onStartEdit}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 6px', fontSize: 12 }}>✎</button>
          <button type="button" title="Remove scene" onClick={onRemove}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 6px', fontSize: 14, lineHeight: 1 }}>×</button>
        </div>
      )}

      {moveMenuOpen && (
        <div style={{
          position: 'absolute', right: 8, top: '100%', zIndex: 10,
          marginTop: 4,
          background: 'var(--bg)',
          border: '0.5px solid var(--border2)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          padding: 4,
          minWidth: 160
        }}>
          <p style={{ fontSize: 10, color: 'var(--text3)', padding: '4px 8px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Move to</p>
          {acts.map(a => (
            <button key={a.id} type="button"
              disabled={a.id === currentActId}
              onClick={() => onMoveTo(a.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '5px 8px', fontSize: 12,
                background: a.id === currentActId ? 'var(--bg3)' : 'transparent',
                color: a.id === currentActId ? 'var(--text3)' : 'var(--text)',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: a.id === currentActId ? 'default' : 'pointer'
              }}>
              {a.id === currentActId ? '✓ ' : ''}{a.name}
            </button>
          ))}
          <button type="button"
            disabled={currentActId === null}
            onClick={() => onMoveTo(null)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '5px 8px', fontSize: 12,
              background: currentActId === null ? 'var(--bg3)' : 'transparent',
              color: currentActId === null ? 'var(--text3)' : 'var(--text2)',
              fontStyle: 'italic',
              border: 'none', borderTop: '0.5px solid var(--border)', marginTop: 2,
              borderRadius: 'var(--radius)',
              cursor: currentActId === null ? 'default' : 'pointer'
            }}>
            {currentActId === null ? '✓ ' : ''}Unassigned
          </button>
        </div>
      )}
    </div>
  )
}
