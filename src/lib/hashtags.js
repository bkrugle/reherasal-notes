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

// Find best match from a list using normalized comparison
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

/**
 * Parse hashtags from note text and return extracted fields + cleaned text
 * @param {string} text - raw note text with hashtags
 * @param {string[]} characters - cast/character list from production
 * @param {string[]} scenes - scene list from production
 * @returns {{ cleanText, category, priority, cast, scene, tags }}
 */
export function parseHashtags(text, characters = [], scenes = []) {
  const tags = []
  let category = null
  let priority = null
  let cast = null
  let scene = null

  // Extract all #tags from text
  const tagPattern = /#([a-zA-Z0-9_]+)/g
  let match

  while ((match = tagPattern.exec(text)) !== null) {
    const raw = match[1]
    const lower = raw.toLowerCase()
    tags.push(raw)

    // Check category
    if (CATEGORY_TAGS[lower]) {
      category = CATEGORY_TAGS[lower]
      continue
    }

    // Check priority
    if (PRIORITY_TAGS[lower]) {
      priority = PRIORITY_TAGS[lower]
      continue
    }

    // Check cast members
    if (!cast) {
      const castMatch = fuzzyMatch(raw, characters)
      if (castMatch) { cast = castMatch; continue }
    }

    // Check scenes
    if (!scene) {
      const sceneMatch = fuzzyMatch(raw, scenes)
      if (sceneMatch) { scene = sceneMatch; continue }
    }
  }

  // Remove recognized hashtags from text, keep unrecognized ones
  let cleanText = text
  const recognizedTags = new Set()

  // Re-scan to identify which tags were recognized
  tagPattern.lastIndex = 0
  while ((match = tagPattern.exec(text)) !== null) {
    const raw = match[1]
    const lower = raw.toLowerCase()
    if (
      CATEGORY_TAGS[lower] ||
      PRIORITY_TAGS[lower] ||
      fuzzyMatch(raw, characters) ||
      fuzzyMatch(raw, scenes)
    ) {
      recognizedTags.add(match[0]) // full #tag string
    }
  }

  recognizedTags.forEach(tag => {
    cleanText = cleanText.replace(tag, '').trim()
  })

  // Clean up double spaces
  cleanText = cleanText.replace(/\s+/g, ' ').trim()

  return { cleanText, category, priority, cast, scene, tags: [...recognizedTags] }
}

/**
 * Get hashtag suggestions as user types
 * @param {string} text - current text
 * @param {string[]} characters
 * @param {string[]} scenes
 * @returns {string[]} suggestions
 */
export function getHashtagSuggestions(text, characters = [], scenes = []) {
  // Find the current incomplete hashtag being typed
  const match = text.match(/#([a-zA-Z0-9_]*)$/)
  if (!match) return []

  const partial = match[1].toLowerCase()
  if (partial.length < 1) return []

  const suggestions = []

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
  scenes.filter(s => normalize(s).includes(partial)).slice(0, 3).forEach(s => {
    suggestions.push('#' + normalize(s))
  })

  return [...new Set(suggestions)].slice(0, 6)
}
