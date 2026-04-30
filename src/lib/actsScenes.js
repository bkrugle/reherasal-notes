// Acts & Scenes data model
// ---------------------------------------------------------------------------
// New structure (Option B):
//   config.acts   = [{ id, name, order }]
//   config.scenes = [{ id, name, actId|null, order }]
//   note.actId    = string|null  (FK to acts[].id)
//   note.sceneId  = string|null  (FK to scenes[].id)  -- replaces old note.scene
//
// Legacy structure (pre-migration):
//   config.scenes = ["Act 1, Scene 2", "Opening Number", ...]
//   note.scene    = "Act 1, Scene 2"   (string)
//
// All migration is automatic on first read (see migrateConfig + migrateNote).
// ---------------------------------------------------------------------------

// ---------- ID generation ---------------------------------------------------

let idCounter = 0
function uid(prefix) {
  // Stable-ish IDs: timestamp + counter + short random. Good enough for
  // single-production scale; collision risk is essentially zero.
  idCounter = (idCounter + 1) % 100000
  const t = Date.now().toString(36)
  const c = idCounter.toString(36).padStart(2, '0')
  const r = Math.random().toString(36).slice(2, 5)
  return `${prefix}-${t}${c}${r}`
}

export const newActId   = () => uid('act')
export const newSceneId = () => uid('scn')

// ---------- Defaults --------------------------------------------------------

/**
 * Build a default acts array given a count.
 * @param {number} count
 * @returns {Array<{id, name, order}>}
 */
export function defaultActs(count = 2) {
  const acts = []
  for (let i = 1; i <= count; i++) {
    acts.push({ id: newActId(), name: `Act ${i}`, order: i })
  }
  return acts
}

// ---------- Migration -------------------------------------------------------

const ACT_REGEX        = /^act\s*(\d+)/i
const ACT_SCENE_REGEX  = /act\s*(\d+)\s*[,\-:\s]+\s*scene\s*(\d+)/i
const SCENE_ONLY_REGEX = /^scene\s*(\d+)/i

/**
 * Detect whether a config is using the legacy flat-string scenes shape.
 */
export function isLegacyConfig(config) {
  if (!config || !Array.isArray(config.scenes)) return false
  if (config.scenes.length === 0) return !Array.isArray(config.acts)
  return typeof config.scenes[0] === 'string'
}

/**
 * Migrate a config from legacy flat scenes to the new acts+scenes structure.
 * - Parses "Act N, Scene M" / "Act N" patterns to assign scenes to acts.
 * - Items that don't match (e.g. "Opening Number", "Bows") become unassigned
 *   scenes (actId: null) which the UI displays in an "Other" bucket.
 * - Returns a NEW config object; does not mutate the input.
 *
 * Idempotent: if config is already in new format, returns it unchanged.
 */
export function migrateConfig(config) {
  if (!config) return config
  if (!isLegacyConfig(config)) {
    // Already migrated (or empty). Ensure acts exists if scenes do.
    if (Array.isArray(config.scenes) && !Array.isArray(config.acts)) {
      return { ...config, acts: defaultActs(2) }
    }
    return config
  }

  const legacyScenes = config.scenes || []

  // Empty legacy → seed default 2 acts and empty scenes
  if (legacyScenes.length === 0) {
    return { ...config, acts: defaultActs(2), scenes: [] }
  }

  // Pass 1: discover act numbers referenced in legacy scene strings
  const actNumbers = new Set()
  legacyScenes.forEach(name => {
    const m = String(name).match(ACT_SCENE_REGEX) || String(name).match(ACT_REGEX)
    if (m) actNumbers.add(parseInt(m[1], 10))
  })

  // Build acts: at least one, plus any discovered numbers
  const sortedNums = [...actNumbers].sort((a, b) => a - b)
  const finalCount = Math.max(sortedNums.length || 0, 1)
  const acts = []
  // Use discovered numbers if we have them, otherwise default to 1..N
  const useDiscovered = sortedNums.length > 0
  for (let i = 0; i < finalCount; i++) {
    const num = useDiscovered ? sortedNums[i] : i + 1
    acts.push({ id: newActId(), name: `Act ${num}`, order: i + 1, _legacyNum: num })
  }

  const actByNum = new Map(acts.map(a => [a._legacyNum, a]))

  // Pass 2: convert each scene string to a scene object
  const scenes = []
  let order = 0
  legacyScenes.forEach(rawName => {
    const name = String(rawName).trim()
    if (!name) return
    let actId = null
    const sceneMatch = name.match(ACT_SCENE_REGEX)
    const actMatch   = name.match(ACT_REGEX)
    if (sceneMatch) {
      const a = actByNum.get(parseInt(sceneMatch[1], 10))
      if (a) actId = a.id
    } else if (actMatch) {
      const a = actByNum.get(parseInt(actMatch[1], 10))
      if (a) actId = a.id
    }
    scenes.push({ id: newSceneId(), name, actId, order: ++order })
  })

  // Strip _legacyNum from acts before returning
  const cleanActs = acts.map(({ _legacyNum, ...rest }) => rest)

  return { ...config, acts: cleanActs, scenes }
}

/**
 * Migrate a single note from legacy `scene: "Act 1, Scene 2"` (string) to
 * `sceneId` + `actId`. Requires the migrated config (with new scenes array)
 * to look up the IDs by name. If no match found, leaves IDs null and keeps
 * the original `scene` string as a label-of-record on `_legacyScene`.
 */
export function migrateNote(note, migratedConfig) {
  if (!note) return note
  // Already migrated (has sceneId or actId fields explicitly set) — leave alone
  if ('sceneId' in note || 'actId' in note) return note

  const legacyScene = note.scene
  if (!legacyScene || typeof legacyScene !== 'string') {
    return { ...note, sceneId: null, actId: null }
  }

  const scenes = migratedConfig?.scenes || []
  const acts = migratedConfig?.acts || []
  const target = String(legacyScene).trim().toLowerCase()
  const found = scenes.find(s => s.name.trim().toLowerCase() === target)

  if (found) {
    return { ...note, sceneId: found.id, actId: found.actId || null }
  }

  // No match — try parsing act number out of the legacy string
  const actMatch = String(legacyScene).match(ACT_REGEX)
  if (actMatch) {
    const num = parseInt(actMatch[1], 10)
    const act = acts.find(a => a.name.match(new RegExp(`act\\s*${num}\\b`, 'i')))
    if (act) return { ...note, sceneId: null, actId: act.id, _legacyScene: legacyScene }
  }

  return { ...note, sceneId: null, actId: null, _legacyScene: legacyScene }
}

// ---------- Lookup helpers --------------------------------------------------

export function findAct(acts, actId) {
  if (!actId || !Array.isArray(acts)) return null
  return acts.find(a => a.id === actId) || null
}

export function findScene(scenes, sceneId) {
  if (!sceneId || !Array.isArray(scenes)) return null
  return scenes.find(s => s.id === sceneId) || null
}

/**
 * Get the display label for an act + scene pairing.
 * Examples:
 *   actName="Act 1", sceneName="Scene 2"      → "Act 1 · Scene 2"
 *   actName=null,    sceneName="Opening"      → "Opening"
 *   actName="Act 1", sceneName=null           → "Act 1"
 *   both null                                  → ""
 */
export function formatActScene(act, scene) {
  const a = act?.name || ''
  const s = scene?.name || ''
  if (a && s) return `${a} · ${s}`
  return a || s || ''
}

/**
 * Group scenes by act, returning [{act, scenes:[...]}, ..., {act:null, scenes:[unassigned]}]
 * Acts are returned in `order`; scenes within each group are returned in `order`.
 * The unassigned bucket is only included if there are unassigned scenes.
 */
export function groupScenesByAct(acts = [], scenes = []) {
  const sortedActs = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
  const groups = sortedActs.map(act => ({
    act,
    scenes: scenes
      .filter(s => s.actId === act.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }))
  const unassigned = scenes
    .filter(s => !s.actId || !sortedActs.find(a => a.id === s.actId))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
  if (unassigned.length) groups.push({ act: null, scenes: unassigned })
  return groups
}

// ---------- Mutations (return new arrays; never mutate) ---------------------

export function addAct(acts, name) {
  const order = (acts.reduce((m, a) => Math.max(m, a.order || 0), 0)) + 1
  return [...acts, { id: newActId(), name: name || `Act ${order}`, order }]
}

export function renameAct(acts, actId, name) {
  return acts.map(a => a.id === actId ? { ...a, name } : a)
}

export function removeAct(acts, scenes, actId) {
  // Removes the act and unassigns any scenes that belonged to it.
  const newActs = acts.filter(a => a.id !== actId).map((a, i) => ({ ...a, order: i + 1 }))
  const newScenes = scenes.map(s => s.actId === actId ? { ...s, actId: null } : s)
  return { acts: newActs, scenes: newScenes }
}

export function reorderActs(acts, orderedIds) {
  const map = new Map(acts.map(a => [a.id, a]))
  return orderedIds.map((id, i) => ({ ...map.get(id), order: i + 1 })).filter(Boolean)
}

export function addScene(scenes, name, actId = null) {
  const order = (scenes.reduce((m, s) => Math.max(m, s.order || 0), 0)) + 1
  return [...scenes, { id: newSceneId(), name, actId, order }]
}

export function renameScene(scenes, sceneId, name) {
  return scenes.map(s => s.id === sceneId ? { ...s, name } : s)
}

export function removeScene(scenes, sceneId) {
  return scenes.filter(s => s.id !== sceneId).map((s, i) => ({ ...s, order: i + 1 }))
}

export function moveSceneToAct(scenes, sceneId, actId) {
  return scenes.map(s => s.id === sceneId ? { ...s, actId } : s)
}

// ---------- Hashtag quick-tag resolution ------------------------------------

/**
 * Resolve a hashtag like "#a1", "#a2", "#act1" to an act object, if any.
 * Returns null if no match.
 */
export function resolveActTag(tag, acts = []) {
  if (!tag) return null
  const lower = String(tag).toLowerCase().replace(/^#/, '')
  // Match #a1 / #a2 / #act1 / #act2 patterns
  const m = lower.match(/^a(?:ct)?(\d+)$/)
  if (!m) return null
  const num = parseInt(m[1], 10)
  // Match by display name "Act N" first
  const byName = acts.find(a => new RegExp(`act\\s*${num}\\b`, 'i').test(a.name))
  if (byName) return byName
  // Fall back to nth act by order
  const sorted = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
  return sorted[num - 1] || null
}

// ---------- Compatibility helpers -------------------------------------------
// During the rollout, the same code may receive `scenes` as either the legacy
// flat-string array or the new array of objects. These helpers normalise.

/**
 * Return scenes as a flat array of strings, regardless of input shape.
 * Accepts ["Act 1", ...] OR [{name: "Act 1", ...}, ...].
 */
export function sceneNames(scenes) {
  if (!Array.isArray(scenes)) return []
  return scenes.map(s => (typeof s === 'string' ? s : (s && s.name) || '')).filter(Boolean)
}

/**
 * True if `scenes` is in the new structured shape ({id, name, ...} objects).
 */
export function isStructuredScenes(scenes) {
  return Array.isArray(scenes) && scenes.length > 0 && typeof scenes[0] === 'object'
}

/**
 * Find a scene by name (case-insensitive). Works on both shapes; returns
 * the scene object on the new shape, or just the matching string on legacy.
 */
export function findSceneByName(scenes, name) {
  if (!Array.isArray(scenes) || !name) return null
  const target = String(name).trim().toLowerCase()
  for (const s of scenes) {
    const sName = typeof s === 'string' ? s : (s && s.name)
    if (sName && sName.trim().toLowerCase() === target) return s
  }
  return null
}

/**
 * Convenience: ensure a config object has the new {acts, scenes} structure.
 * Idempotent — safe to call on already-migrated configs.
 * Use this in components that need to consume the structured data even when
 * the backend hasn't migrated yet.
 */
export function ensureMigrated(config) {
  if (!config) return config
  if (isLegacyConfig(config)) return migrateConfig(config)
  if (!Array.isArray(config.acts)) {
    return { ...config, acts: defaultActs(2) }
  }
  return config
}
