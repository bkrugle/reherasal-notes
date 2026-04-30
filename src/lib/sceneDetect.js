// Smart scene detection from calendar event title/description
// Tries to match event text against known scenes

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

// Coerce a scenes argument that may be either:
//   - legacy: ["Act 1", "Opening Number", ...]
//   - structured: [{id, name, actId, order}, ...]
// into a flat string array.
function toSceneNames(scenes) {
  if (!Array.isArray(scenes)) return []
  return scenes.map(s => (typeof s === 'string' ? s : (s && s.name) || '')).filter(Boolean)
}

// Patterns that suggest specific scenes
const SCENE_PATTERNS = [
  // Act + scene number patterns
  { regex: /act\s*(\d+)\s*[,\-\s]+scene\s*(\d+)/i, build: (m) => `Act ${m[1]}, Scene ${m[2]}` },
  { regex: /a(\d+)\s*[,\-\s]*s(\d+)/i, build: (m) => `Act ${m[1]}, Scene ${m[2]}` },
  // Act only
  { regex: /act\s*(\d+)/i, build: (m) => `Act ${m[1]}` },
  // Scene only
  { regex: /scene\s*(\d+)/i, build: (m) => `Scene ${m[1]}` },
  // Common keywords
  { regex: /opening\s*(number|scene)?/i, build: () => 'Opening number' },
  { regex: /bows?|curtain\s*call/i, build: () => 'Bows' },
  { regex: /full\s*(run|show|cast|production)/i, build: () => 'Full run' },
  { regex: /protagonist\s*scenes?/i, build: () => null },
]

/**
 * Detect scenes from event title and description
 * @param {string} title - event title
 * @param {string} description - event description
 * @param {string[]|object[]} scenes - known scenes (legacy strings or structured objects)
 * @returns {{ detectedScenes: string[], suggestedScene: string|null, confidence: 'high'|'medium'|'low' }}
 */
export function detectScenesFromEvent(title, description, scenes = []) {
  const sceneList = toSceneNames(scenes)   // <- defensive normalization
  const fullText = `${title} ${description}`
  const normFull = normalize(fullText)
  const detectedScenes = []
  let suggestedScene = null
  let confidence = 'low'

  // 1. Direct match against known scenes (highest confidence)
  for (const scene of sceneList) {
    const normScene = normalize(scene)
    if (normFull.includes(normScene)) {
      detectedScenes.push(scene)
      if (!suggestedScene) { suggestedScene = scene; confidence = 'high' }
    }
  }

  // 2. Pattern matching to build scene names (medium confidence)
  if (!suggestedScene) {
    for (const pattern of SCENE_PATTERNS) {
      const match = fullText.match(pattern.regex)
      if (match) {
        const built = pattern.build(match)
        if (built) {
          // Try to find matching scene in known list
          const found = sceneList.find(s => normalize(s).includes(normalize(built)))
          suggestedScene = found || built
          confidence = found ? 'high' : 'medium'
          if (!detectedScenes.includes(suggestedScene)) detectedScenes.push(suggestedScene)
        }
        break
      }
    }
  }

  // 3. Fuzzy keyword matching (low confidence)
  if (!suggestedScene && sceneList.length) {
    const words = normFull.split(/\s+/)
    for (const scene of sceneList) {
      const sceneWords = normalize(scene).split(/\s+/)
      const matches = sceneWords.filter(w => w.length > 3 && words.includes(w))
      if (matches.length >= 2) {
        suggestedScene = scene
        confidence = 'low'
        detectedScenes.push(scene)
        break
      }
    }
  }

  return { detectedScenes, suggestedScene, confidence }
}

/**
 * Get a human-readable summary of what was detected from an event
 */
export function getEventSummary(event) {
  if (!event) return ''
  const dt = new Date(event.start)
  const dateLabel = dt.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  const timeLabel = event.allDay ? '' : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return [dateLabel, timeLabel].filter(Boolean).join(' at ')
}

/**
 * Extract a date string (YYYY-MM-DD) from a calendar event
 */
export function eventToDate(event) {
  if (!event?.start) return new Date().toISOString().slice(0, 10)
  const d = new Date(event.start)
  return d.toISOString().slice(0, 10)
}
