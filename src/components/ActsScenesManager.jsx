import { useState, useRef, useMemo } from 'react'
import {
  defaultActs,
  ensureMigrated,
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
 * ActsScenesManager — drag-and-drop manager for acts & scenes.
 *
 * Props:
 *   acts        — [{id, name, order}]
 *   scenes      — [{id, name, actId|null, order}]
 *   legacyScenes— optional fallback flat string array (used only when both
 *                 acts and scenes are empty AND we have a legacy list to seed from)
 *   onChange    — ({acts, scenes}) => void  — fires on every mutation
 *   onLookup    — optional async () => {acts, scenes_struct}
 *   lookupBusy  — disable lookup button while parent is fetching
 *   showTitle   — for the lookup button label
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
  // Decide what data to show right now.
  // We do NOT auto-fire onChange during render — that was the source of the
  // last bug (resetting scenes to [] during a re-render). Instead, the user
  // gets a "Get started" button if there's truly nothing yet.
  const { acts, scenes, isEmpty } = useMemo(() => {
    const haveActs = Array.isArray(actsProp) && actsProp.length > 0
    const haveScenes = Array.isArray(scenesProp) && scenesProp.length > 0
    if (haveActs || haveScenes) {
      return { acts: actsProp, scenes: scenesProp || [], isEmpty: false }
    }
    return { acts: [], scenes: [], isEmpty: true }
  }, [actsProp, scenesProp])

  // UI-only state
  const [collapsed, setCollapsed] = useState({})
  const [editingActId, setEditingActId] = useState(null)
  const [editingActName, setEditingActName] = useState('')
  const [editingSceneId, setEditingSceneId] = useState(null)
  const [editingSceneName, setEditingSceneName] = useState('')
  const [newSceneInput, setNewSceneInput] = useState({})
  const [newActName, setNewActName] = useState('')
  const [showLegend, setShowLegend] = useState(false)
  const [moveMenuFor, setMoveMenuFor] = useState(null)

  // Drag state
  const dragSceneRef = useRef(null)
  const dragActRef   = useRef(null)
  const [dragOverAct, setDragOverAct] = useState(null)
  const [dragOverScene, setDragOverScene] = useState(null)

  function commit(nextActs, nextScenes) {
    onChange && onChange({ acts: nextActs, scenes: nextScenes })
  }

  // ---- "get started" handlers --------------------------------------------

  function bootstrapFromLegacy() {
    if (Array.isArray(legacyScenes) && legacyScenes.length > 0) {
      const migrated = ensureMigrated({ scenes: legacyScenes })
      commit(migrated.acts, migrated.scenes)
    } else {
      commit(defaultActs(2), [])
    }
  }

  function bootstrapFresh(count) {
    commit(defaultActs(count), [])
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
    setEditingActId(null); setEditingActName('')
  }
  function cancelEditAct() {
    setEditingActId(null); setEditingActName('')
  }

  function handleRemoveAct(act) {
    const orphans = scenes.filter(s => s.actId === act.id)
    const msg = orphans.length
      ? `Remove "${act.name}"? ${orphans.length} scene${orphans.length === 1 ? '' : 's'} will move to "Unassigned".`
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
    setEditingSceneId(null); setEditingSceneName('')
  }
  function cancelEditScene() {
    setEditingSceneId(null); setEditingSceneName('')
  }

  function handleRemoveScene(scene) {
    if (!confirm(`Remove scene "${scene.name}"?`)) return
    commit(acts, libRemoveScene(scenes, scene.id))
  }

  function handleMoveSceneToAct(sceneId, targetActId) {
    commit(acts, libMoveSceneToAct(scenes, sceneId, targetActId))
    setMoveMenuFor(null)
  }

  // ---- drag and drop ------------------------------------------------------

  function onSceneDragStart(e, scene) {
    dragSceneRef.current = { sceneId: scene.id }
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', scene.id) } catch {}
  }
  function onSceneDragEnd() {
    dragSceneRef.current = null
    setDragOverAct(null)
    setDragOverScene(null)
  }
  function onActDragOver(e, actId) {
    if (dragSceneRef.current || dragActRef.current) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
    if (dragSceneRef.current) setDragOverAct(actId === undefined || actId === null ? '__none' : actId)
  }
  function onActDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return
    setDragOverAct(null)
  }
  function onActDrop(e, targetActId) {
    e.preventDefault()
    const dragScene = dragSceneRef.current
    if (dragScene) {
      const scene = scenes.find(s => s.id === dragScene.sceneId)
      if (!scene) return onSceneDragEnd()
      const normTarget = targetActId === undefined ? null : targetActId
      if (scene.actId === normTarget && dragOverScene && dragOverScene.actId === normTarget) {
        reorderSceneTo(scene.id, dragOverScene.sceneId, dragOverScene.before)
      } else {
        commit(acts, libMoveSceneToAct(scenes, scene.id, normTarget))
      }
    }
    onSceneDragEnd()
  }

  function reorderSceneTo(movingSceneId, targetSceneId, before) {
    const moving = scenes.find(s => s.id === movingSceneId)
    const target = scenes.find(s => s.id === targetSceneId)
    if (!moving || !target || moving.id === target.id) return
    if (moving.actId !== target.actId) {
      commit(acts, libMoveSceneToAct(scenes, movingSceneId, target.actId))
      return
    }
    const inSameAct = scenes
      .filter(s => s.actId === moving.actId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    const idsWithoutMoving = inSameAct.map(s => s.id).filter(id => id !== movingSceneId)
    const targetIdx = idsWithoutMoving.indexOf(targetSceneId)
    if (targetIdx === -1) return
    const insertAt = before ? targetIdx : targetIdx + 1
    idsWithoutMoving.splice(insertAt, 0, movingSceneId)
    const orderById = new Map(idsWithoutMoving.map((id, i) => [id, i + 1]))
    const next = scenes.map(s => {
      if (s.actId !== moving.actId) return s
      return { ...s, order: orderById.get(s.id) ?? s.order }
    })
    commit(acts, next)
  }

  function onSceneDragOver(e, scene) {
    if (!dragSceneRef.current) return
    const draggingId = dragSceneRef.current.sceneId
    if (draggingId === scene.id) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const before = (e.clientY - rect.top) < (rect.height / 2)
    setDragOverScene({ sceneId: scene.id, actId: scene.actId, before })
    setDragOverAct(scene.actId === null ? '__none' : scene.actId)
  }

  function onActHandleDragStart(e, act) {
    dragActRef.current = { actId: act.id }
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', act.id) } catch {}
  }
  function onActHandleDragEnd() {
    dragActRef.current = null
    setDragOverAct(null)
  }
  function onActSectionDragOver(e, act) {
    if (!dragActRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverAct(act.id)
  }
  function onActSectionDrop(e, targetAct) {
    if (!dragActRef.current) return
    e.preventDefault()
    const movingId = dragActRef.current.actId
    if (movingId === targetAct.id) return onActHandleDragEnd()
    const sorted = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
    const ids = sorted.map(a => a.id).filter(id => id !== movingId)
    const targetIdx = ids.indexOf(targetAct.id)
    if (targetIdx === -1) return onActHandleDragEnd()
    ids.splice(targetIdx, 0, movingId)
    commit(libReorderActs(acts, ids), scenes)
    onActHandleDragEnd()
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

  if (isEmpty) {
    const hasLegacy = Array.isArray(legacyScenes) && legacyScenes.length > 0
    return (
      <div style={{ background: 'var(--bg2)', border: '0.5px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>
          {hasLegacy
            ? `You have ${legacyScenes.length} scenes from before — import and organize them into acts?`
            : 'No acts or scenes yet. Get started:'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {hasLegacy && (
            <button type="button" className="btn btn-primary" onClick={bootstrapFromLegacy}>
              Import {legacyScenes.length} existing scene{legacyScenes.length === 1 ? '' : 's'}
            </button>
          )}
          <button type="button" className="btn" onClick={() => bootstrapFresh(1)}>
            Start with 1 act
          </button>
          <button type="button" className="btn" onClick={() => bootstrapFresh(2)}>
            Start with 2 acts
          </button>
          <button type="button" className="btn" onClick={() => bootstrapFresh(3)}>
            Start with 3 acts
          </button>
          {onLookup && showTitle && (
            <button type="button" className="btn" onClick={doLookup} disabled={lookupBusy}
              style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', borderColor: 'transparent', fontWeight: 500 }}>
              {lookupBusy ? '✨ Looking up…' : `✨ Auto-populate from "${showTitle}"`}
            </button>
          )}
        </div>
      </div>
    )
  }

  const sortedActs = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
  const groups = groupScenesByAct(acts, scenes)

  return (
    <div>
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

      {showLegend && (
        <div style={{ background: 'var(--purple-bg)', border: '0.5px solid var(--purple-text)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--purple-text)', marginBottom: 6 }}>
            Quick-tag shortcuts (use in note text — coming soon)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {sortedActs.slice(0, 6).map((a, i) => (
              <span key={a.id} style={{ padding: '2px 8px', background: 'var(--bg)', borderRadius: 12, color: 'var(--purple-text)', border: '0.5px solid var(--purple-text)' }}>
                #a{i + 1} → {a.name}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--purple-text)', opacity: 0.8, marginTop: 6 }}>
            Drag the ⋮⋮ handle on any scene or act to move/reorder.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(({ act, scenes: actScenes }) => {
          const isUnassigned = !act
          const collapseKey = act?.id || '__none'
          const isCollapsed = collapsed[collapseKey]
          const actIndex = act ? sortedActs.findIndex(a => a.id === act.id) : -1
          const isFirst = actIndex === 0
          const isLast = actIndex === sortedActs.length - 1
          const inputKey = act?.id || '__none'
          const dropZoneKey = act?.id ?? '__none'
          const isDropTarget = dragOverAct === dropZoneKey && dragSceneRef.current

          return (
            <div key={collapseKey}
              onDragOver={(e) => onActDragOver(e, act?.id)}
              onDragLeave={onActDragLeave}
              onDrop={(e) => onActDrop(e, act?.id)}
              style={{
                background: isUnassigned ? 'var(--bg2)' : 'var(--bg)',
                border: `${isDropTarget ? '1.5px solid var(--blue-text)' : '0.5px solid'} ${isUnassigned ? 'var(--border)' : 'var(--border2)'}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                transition: 'border-color 80ms'
              }}>
              <div
                onDragOver={act ? (e) => onActSectionDragOver(e, act) : undefined}
                onDrop={act ? (e) => onActSectionDrop(e, act) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 12px',
                  background: isUnassigned ? 'transparent' : 'var(--bg2)',
                  borderBottom: isCollapsed ? 'none' : `0.5px solid var(--border)`
                }}>
                {act && (
                  <span
                    draggable
                    onDragStart={(e) => onActHandleDragStart(e, act)}
                    onDragEnd={onActHandleDragEnd}
                    title="Drag to reorder"
                    style={{ cursor: 'grab', color: 'var(--text3)', fontSize: 14, padding: '0 4px', userSelect: 'none', lineHeight: 1 }}>
                    ⋮⋮
                  </span>
                )}

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

              {!isCollapsed && (
                <div style={{ padding: '8px 12px 12px' }}>
                  {actScenes.length === 0 && !isUnassigned && (
                    <p style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', margin: '4px 0 8px' }}>
                      No scenes yet — add one below or drag from another act.
                    </p>
                  )}

                  {actScenes.map(scene => {
                    const showDropLineBefore = dragOverScene && dragOverScene.sceneId === scene.id && dragOverScene.before
                    const showDropLineAfter  = dragOverScene && dragOverScene.sceneId === scene.id && !dragOverScene.before
                    return (
                      <div key={scene.id}>
                        {showDropLineBefore && <DropLine />}
                        <SceneRow
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
                          onDragStart={(e) => onSceneDragStart(e, scene)}
                          onDragEnd={onSceneDragEnd}
                          onDragOver={(e) => onSceneDragOver(e, scene)}
                        />
                        {showDropLineAfter && <DropLine />}
                      </div>
                    )
                  })}

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
          Tip: drag the ⋮⋮ handle on a scene to move it to another act, or to reorder within an act.
        </p>
      </div>
    </div>
  )
}

function DropLine() {
  return (
    <div style={{
      height: 2, background: 'var(--blue-text)', borderRadius: 1,
      margin: '2px 0', opacity: 0.8
    }} />
  )
}

function SceneRow({
  scene, acts, currentActId,
  isEditing, editingName, setEditingName,
  moveMenuOpen,
  onStartEdit, onSaveEdit, onCancelEdit, onRemove,
  onOpenMoveMenu, onMoveTo,
  onDragStart, onDragEnd, onDragOver
}) {
  return (
    <div
      onDragOver={onDragOver}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px',
        background: 'var(--bg)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius)',
        marginBottom: 4,
        position: 'relative'
      }}>
      <span
        draggable={!isEditing}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to move/reorder"
        style={{
          cursor: isEditing ? 'default' : 'grab',
          color: 'var(--text3)',
          fontSize: 12,
          padding: '0 4px',
          userSelect: 'none',
          lineHeight: 1
        }}>
        ⋮⋮
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
                border: 'none', borderRadius: 'var(--radius)',
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
