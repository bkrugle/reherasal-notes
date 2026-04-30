// Hashtag parser for rehearsal notes
// Parses #tags from note text and extracts field values

const CATEGORY_TAGS = {
  blocking: 'blocking',
  block: 'blocking',
  performance: 'performance',
  perf: 'performance',
  acting: 'performance',
  music: 'music',
  vocals: 'music',
  vocal: 'music',
  singing: 'music',
  technical: 'technical',
  tech: 'technical',
  lights: 'technical',
  lighting: 'technical',
  sound: 'technical',
  audio: 'technical',
  costume: 'costume',
  costumes: 'costume',
  wardrobe: 'costume',
  set: 'set',
  props: 'set',
  prop: 'set',
  preset: 'set',
  general: 'general',
}

// Department tags — stored in cast field for routing notes to specific departments
const DEPARTMENT_TAGS = {
  lights: 'lights',
  lighting: 'lights',
  sound: 'sound',
  audio: 'sound',
  costumes: 'costumes',
  costume: 'costumes',
  wardrobe: 'costumes',
  props: 'props',
  prop: 'props',
  set: 'set',
  choreo: 'choreography',
}

const PRIORITY_TAGS = {
  high: 'high',
  urgent: 'high',
  critical: 'high',
  important: 'high',
  low: 'low',
  minor: 'low',
  polish: 'low',
}

// Normalize a string for fuzzy matching
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Coerce a scenes argument that may be either:
//   - legacy: ["Act 1", "Opening Number", ...]
//   - structured: [{id, name, actId, order}, ...]
// into a flat string array AND a parallel structured array (when available).
function normalizeScenes(scenes) {
  if (!Array.isArray(scenes)) return { names: [], structured: null }
  if (scenes.length === 0) return { names: [], structured: [] }
  if (typeof scenes[0] === 'string') {
    return { names: scenes, structured: null }
  }
  return {
    names: scenes.map(s => (s && s.name) || '').filter(Boolean),
    structured: scenes
  }
}

// Find best match from a string list using normalized comparison
function fuzzyMatch(tag, list) {
  const norm = normalize(tag)
  // Exact match first
  const exact = list.find(item => normalize(item) === norm)
  if (exact) return exact
  // Starts with
  const starts = list.find(item => normalize(item).startsWith(norm) && norm.length >= 3)
  if (starts) return starts
  // Contains
  const contains = list.find(item => normalize(item).includes(norm) && norm.length >= 4)
  if (contains) return contains
  return null
}

// Resolve an act-style tag like "a1", "act1", "act2" against an acts array.
// Returns the matching act object or null.
function resolveActFromTag(tag, acts) {
  if (!Array.isArray(acts) || acts.length === 0) return null
  const lower = String(tag).toLowerCase()
  // Pattern: a1 / a2 / act1 / act2
  const m = lower.match(/^a(?:ct)?(\d+)$/)
  if (m) {
    const num = parseInt(m[1], 10)
    // Match by name "Act N" first
    const byName = acts.find(a => new RegExp(`act\\s*${num}\\b`, 'i').test(a.name))
    if (byName) return byName
    // Fall back to nth act by order
    const sorted = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
    return sorted[num - 1] || null
  }
  // Also allow custom act-name matches: #prologue → act named "Prologue"
  // Use fuzzy match on act names for short non-numeric tags
  const sorted = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
  const byFuzzy = sorted.find(a => normalize(a.name) === normalize(tag))
  if (byFuzzy) return byFuzzy
  // Don't match on partial — too risky for false positives on category tags
  return null
}

/**
 * Parse hashtags from note text and return extracted fields + cleaned text.
 *
 * @param {string} text - raw note text with hashtags
 * @param {string[]} characters - cast/character list from production
 * @param {string[]|object[]} scenes - scene list (legacy strings or structured objects)
 * @param {object[]} [acts] - acts list ([{id, name, order}]) — enables #a1 quick-tags
 * @returns {{ cleanText, category, priority, cast, scene, sceneId, actId, tags }}
 */
export function parseHashtags(text, characters = [], scenes = [], acts = []) {
  const sceneInfo = normalizeScenes(scenes)
  const sceneNames = sceneInfo.names
  const sceneObjs = sceneInfo.structured

  const tags = []
  let categories = []
  let priority = null
  let castList = []
  let scene = null      // matched scene NAME (legacy field — string)
  let sceneId = null    // matched scene ID (new — only set if structured scenes available)
  let actId = null      // matched act ID

  // Extract all #tags and @mentions from text
  const tagPattern = /[#@]([a-zA-Z0-9_]+)/g
  let match

  while ((match = tagPattern.exec(text)) !== null) {
    const raw = match[1]
    const lower = raw.toLowerCase()
    const isMention = match[0].startsWith('@')
    tags.push(raw)

    // @ mentions always try cast first
    if (isMention) {
      const castMatch = fuzzyMatch(raw, characters)
      if (castMatch && !castList.includes(castMatch)) { castList.push(castMatch); continue }
      continue
    }

    // Check category — accumulate multiple
    if (CATEGORY_TAGS[lower]) {
      const cat = CATEGORY_TAGS[lower]
      if (!categories.includes(cat)) categories.push(cat)
      // Also store department-specific tags in castList for note routing
      if (DEPARTMENT_TAGS[lower] && !castList.includes(DEPARTMENT_TAGS[lower])) {
        castList.push(DEPARTMENT_TAGS[lower])
      }
      continue
    }

    // Check priority
    if (PRIORITY_TAGS[lower]) {
      priority = PRIORITY_TAGS[lower]
      continue
    }

    // Check act tags (NEW: #a1, #a2, #act1, etc.)
    if (!actId) {
      const actMatch = resolveActFromTag(raw, acts)
      if (actMatch) {
        actId = actMatch.id
        continue
      }
    }

    // Check cast members — accumulate multiple
    {
      const castMatch = fuzzyMatch(raw, characters)
      if (castMatch && !castList.includes(castMatch)) { castList.push(castMatch); continue }
    }

    // Check scenes
    if (!scene) {
      const sceneMatch = fuzzyMatch(raw, sceneNames)
      if (sceneMatch) {
        scene = sceneMatch
        // If we have structured scenes, also resolve to sceneId + inferred actId
        if (sceneObjs) {
          const sceneObj = sceneObjs.find(s => s.name === sceneMatch)
          if (sceneObj) {
            sceneId = sceneObj.id
            // Scene's own actId wins over a separately-tagged act
            // (consistency: a note tagged to a specific scene should belong to that scene's act)
            if (sceneObj.actId) actId = sceneObj.actId
          }
        }
        continue
      }
    }
  }

  // Remove recognized tags/mentions from text, keep unrecognized ones
  let cleanText = text
  const recognizedTags = new Set()

  // Re-scan to identify which tags were recognized
  tagPattern.lastIndex = 0
  while ((match = tagPattern.exec(text)) !== null) {
    const raw = match[1]
    const lower = raw.toLowerCase()
    const isMention = match[0].startsWith('@')
    if (isMention) {
      if (fuzzyMatch(raw, characters)) recognizedTags.add(match[0])
    } else if (
      CATEGORY_TAGS[lower] ||
      PRIORITY_TAGS[lower] ||
      resolveActFromTag(raw, acts) ||
      fuzzyMatch(raw, characters) ||
      fuzzyMatch(raw, sceneNames)
    ) {
      recognizedTags.add(match[0])
    }
  }

  recognizedTags.forEach(tag => {
    cleanText = cleanText.replace(tag, '').trim()
  })

  // Clean up double spaces
  cleanText = cleanText.replace(/\s+/g, ' ').trim()

  return {
    cleanText,
    category: categories.length > 0 ? categories.join(', ') : null,
    priority,
    cast: castList.length > 0 ? castList.join(', ') : null,
    scene,
    sceneId,
    actId,
    tags: [...recognizedTags]
  }
}

/**
 * Get hashtag suggestions as user types
 * @param {string} text - current text
 * @param {string[]} characters
 * @param {string[]|object[]} scenes
 * @param {object[]} [acts] - acts list — enables #a1 / #a2 suggestions
 * @returns {string[]} suggestions
 */
export function getHashtagSuggestions(text, characters = [], scenes = [], acts = []) {
  const sceneInfo = normalizeScenes(scenes)
  const sceneNames = sceneInfo.names

  // Find the current incomplete hashtag or @mention being typed
  const match = text.match(/[#@]([a-zA-Z0-9_]*)$/)
  if (!match) return []

  const isMention = match[0].startsWith('@')
  const partial = match[1].toLowerCase()
  if (partial.length < 1 && !isMention) return []

  const suggestions = []

  if (isMention) {
    // @ always suggests cast members
    characters
      .filter(c => partial.length === 0 || normalize(c).includes(partial))
      .slice(0, 6)
      .forEach(c => suggestions.push('@' + c.replace(/\s+/g, '')))
  } else {
    // Act suggestions (NEW): when user types "a" or "ac" or "act"
    if (Array.isArray(acts) && acts.length > 0) {
      const sortedActs = [...acts].sort((a, b) => (a.order || 0) - (b.order || 0))
      sortedActs.forEach((a, i) => {
        const tag = `#a${i + 1}`
        if (tag.slice(1).startsWith(partial) || `act${i + 1}`.startsWith(partial)) {
          suggestions.push(tag)
        }
      })
    }

    // Category suggestions
    const catKeys = [...new Set(Object.keys(CATEGORY_TAGS))]
    catKeys.filter(k => k.startsWith(partial)).forEach(k => suggestions.push('#' + k))

    // Priority suggestions
    Object.keys(PRIORITY_TAGS).filter(k => k.startsWith(partial)).forEach(k => suggestions.push('#' + k))

    // Cast suggestions
    characters.filter(c => normalize(c).includes(partial)).slice(0, 4).forEach(c => {
      suggestions.push('#' + c.split(' ')[0].toLowerCase())
    })

    // Scene suggestions
    sceneNames.filter(s => normalize(s).includes(partial)).slice(0, 3).forEach(s => {
      suggestions.push('#' + normalize(s))
    })
  }

  return [...new Set(suggestions)].slice(0, 6)
}
