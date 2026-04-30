'use strict'

// Backend mirror of src/lib/actsScenes.js (CommonJS)
// Keeps the data model logic in sync between client and server.
// If you change one, change the other.
// ---------------------------------------------------------------------------

let idCounter = 0
function uid(prefix) {
  idCounter = (idCounter + 1) % 100000
  const t = Date.now().toString(36)
  const c = idCounter.toString(36).padStart(2, '0')
  const r = Math.random().toString(36).slice(2, 5)
  return `${prefix}-${t}${c}${r}`
}

const newActId   = () => uid('act')
const newSceneId = () => uid('scn')

function defaultActs(count) {
  count = count || 2
  const acts = []
  for (let i = 1; i <= count; i++) {
    acts.push({ id: newActId(), name: `Act ${i}`, order: i })
  }
  return acts
}

const ACT_REGEX        = /^act\s*(\d+)/i
const ACT_SCENE_REGEX  = /act\s*(\d+)\s*[,\-:\s]+\s*scene\s*(\d+)/i

function isLegacyConfig(config) {
  if (!config || !Array.isArray(config.scenes)) return false
  if (config.scenes.length === 0) return !Array.isArray(config.acts)
  return typeof config.scenes[0] === 'string'
}

function migrateConfig(config) {
  if (!config) return config
  if (!isLegacyConfig(config)) {
    if (Array.isArray(config.scenes) && !Array.isArray(config.acts)) {
      return Object.assign({}, config, { acts: defaultActs(2) })
    }
    return config
  }

  const legacyScenes = config.scenes || []

  const actNumbers = new Set()
  legacyScenes.forEach(name => {
    const m = String(name).match(ACT_SCENE_REGEX) || String(name).match(ACT_REGEX)
    if (m) actNumbers.add(parseInt(m[1], 10))
  })

  const sortedNums = [...actNumbers].sort((a, b) => a - b)
  const finalCount = Math.max(sortedNums.length || 0, 1)
  const acts = []
  const useDiscovered = sortedNums.length > 0
  for (let i = 0; i < finalCount; i++) {
    const num = useDiscovered ? sortedNums[i] : i + 1
    acts.push({ id: newActId(), name: `Act ${num}`, order: i + 1, _legacyNum: num })
  }

  const actByNum = new Map(acts.map(a => [a._legacyNum, a]))

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

  const cleanActs = acts.map(a => {
    const copy = Object.assign({}, a)
    delete copy._legacyNum
    return copy
  })

  return Object.assign({}, config, { acts: cleanActs, scenes })
}

function migrateNote(note, migratedConfig) {
  if (!note) return note
  if (Object.prototype.hasOwnProperty.call(note, 'sceneId') ||
      Object.prototype.hasOwnProperty.call(note, 'actId')) return note

  const legacyScene = note.scene
  if (!legacyScene || typeof legacyScene !== 'string') {
    return Object.assign({}, note, { sceneId: null, actId: null })
  }

  const scenes = (migratedConfig && migratedConfig.scenes) || []
  const acts = (migratedConfig && migratedConfig.acts) || []
  const target = String(legacyScene).trim().toLowerCase()
  const found = scenes.find(s => s.name.trim().toLowerCase() === target)

  if (found) {
    return Object.assign({}, note, { sceneId: found.id, actId: found.actId || null })
  }

  const actMatch = String(legacyScene).match(ACT_REGEX)
  if (actMatch) {
    const num = parseInt(actMatch[1], 10)
    const act = acts.find(a => new RegExp('act\\s*' + num + '\\b', 'i').test(a.name))
    if (act) {
      return Object.assign({}, note, { sceneId: null, actId: act.id, _legacyScene: legacyScene })
    }
  }

  return Object.assign({}, note, { sceneId: null, actId: null, _legacyScene: legacyScene })
}

module.exports = {
  newActId, newSceneId, defaultActs,
  isLegacyConfig, migrateConfig, migrateNote
}
