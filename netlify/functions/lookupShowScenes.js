'use strict'

const { CORS, ok, err } = require('./_sheets')
const { newActId, newSceneId, defaultActs } = require('./_actsScenes')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { showTitle } = body
  if (!showTitle) return err('showTitle required')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return err('ANTHROPIC_API_KEY not configured', 500)

  // Structured prompt: ask Claude to return acts grouped with their scenes,
  // plus an "extras" list for things that don't belong to a specific act
  // (Bows, Full Run, Pit Rehearsal, etc.)
  const prompt = `For the musical or play "${showTitle}", list the acts and scenes as a director would use them for rehearsal notes.

Return ONLY valid JSON with this exact structure, nothing else. No explanation, no markdown, no backticks:
{
  "acts": [
    { "name": "Act 1", "scenes": ["Scene 1", "Scene 2", "Opening Number"] },
    { "name": "Act 2", "scenes": ["Scene 1", "Finale"] }
  ],
  "extras": ["Full Run", "Bows", "Pit Rehearsal"]
}

Rules:
- Use the format directors actually use for scene names (e.g. "Scene 1", "Opening Number", "Defying Gravity")
- "extras" is for entries that aren't tied to a specific act — generic things like "Full Run", "Bows", "Pit Rehearsal", "Sitzprobe"
- Include 1-2 acts unless the show genuinely has more (most musicals are 2 acts; most plays are 1-3)
- Keep total entries practical — 15-25 max across everything
- Songs/musical numbers go inside whichever act they appear in

If you don't recognize "${showTitle}" as a specific show, return:
{ "acts": [{ "name": "Act 1", "scenes": [] }, { "name": "Act 2", "scenes": [] }], "extras": ["Full Run", "Bows", "Pit Rehearsal"] }`

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,  // Bumped from 500 — structured output needs more headroom
      messages: [{ role: 'user', content: prompt }]
    })

    const response = await new Promise((resolve, reject) => {
      const https = require('https')
      const req = https.request({
        hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
        headers: {
          'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
          'content-type': 'application/json', 'content-length': Buffer.byteLength(requestBody)
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve({ status: res.statusCode, body: data }))
      })
      req.on('error', reject)
      req.setTimeout(28000, () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(requestBody); req.end()
    })

    let parsed
    try { parsed = JSON.parse(response.body) } catch { return err('Invalid API response', 500) }
    if (response.status >= 400) return err(parsed.error?.message || 'API error', 500)

    const text = parsed.content?.[0]?.text || '{}'

    // Try to parse the structured response. Be forgiving:
    //   1. Strip any backticks/code fences
    //   2. Try direct JSON.parse
    //   3. Fall back to extracting the first {...} object
    //   4. As a last resort, try the legacy flat array shape and convert
    let structured = null
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
    try {
      structured = JSON.parse(cleaned)
    } catch {
      const objMatch = cleaned.match(/\{[\s\S]*\}/)
      if (objMatch) { try { structured = JSON.parse(objMatch[0]) } catch {} }
      if (!structured) {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/)
        if (arrMatch) {
          try {
            const flat = JSON.parse(arrMatch[0])
            if (Array.isArray(flat)) structured = legacyArrayToStructured(flat)
          } catch {}
        }
      }
    }

    // Sanity check the structure
    if (!structured || !Array.isArray(structured.acts)) {
      structured = { acts: [{ name: 'Act 1', scenes: [] }, { name: 'Act 2', scenes: [] }], extras: ['Full Run', 'Bows', 'Pit Rehearsal'] }
    }

    // Normalize → assign stable IDs and order. This is the canonical shape
    // that gets stored in Config and used everywhere downstream.
    const acts = []
    const scenes = []
    let actOrder = 0
    let sceneOrder = 0

    structured.acts.forEach((a) => {
      if (!a || typeof a.name !== 'string' || !a.name.trim()) return
      const actId = newActId()
      acts.push({ id: actId, name: a.name.trim(), order: ++actOrder })
      const acScenes = Array.isArray(a.scenes) ? a.scenes : []
      acScenes.forEach((s) => {
        const name = (typeof s === 'string') ? s : (s && s.name)
        if (!name) return
        scenes.push({ id: newSceneId(), name: String(name).trim(), actId, order: ++sceneOrder })
      })
    })

    // Extras go in as unassigned scenes (actId: null)
    const extras = Array.isArray(structured.extras) ? structured.extras : []
    extras.forEach((s) => {
      const name = (typeof s === 'string') ? s : (s && s.name)
      if (!name) return
      scenes.push({ id: newSceneId(), name: String(name).trim(), actId: null, order: ++sceneOrder })
    })

    // Backward-compat flat array — for any UI piece not yet updated
    const flat = scenes.map(s => s.name)

    return ok({ acts, scenes, scenes_flat: flat, showTitle })
  } catch (e) {
    console.error('lookupShowScenes error:', e.message)
    return err(e.message, 500)
  }
}

// Convert a legacy flat array (["Act 1", "Act 1, Scene 2", ...]) into the
// structured shape Claude is now expected to return. Used as a fallback when
// the model returns the old format.
function legacyArrayToStructured(arr) {
  const ACT_REGEX = /^act\s*(\d+)$/i
  const ACT_SCENE_REGEX = /^act\s*(\d+)\s*[,\-:]\s*(.+)$/i
  const acts = []
  const extras = []
  arr.forEach(name => {
    const s = String(name).trim()
    if (!s) return
    let m = s.match(ACT_SCENE_REGEX)
    if (m) {
      const num = parseInt(m[1], 10)
      let act = acts.find(a => a._num === num)
      if (!act) { act = { name: `Act ${num}`, scenes: [], _num: num }; acts.push(act) }
      act.scenes.push(m[2])
      return
    }
    m = s.match(ACT_REGEX)
    if (m) {
      const num = parseInt(m[1], 10)
      let act = acts.find(a => a._num === num)
      if (!act) { act = { name: `Act ${num}`, scenes: [], _num: num }; acts.push(act) }
      return
    }
    extras.push(s)
  })
  acts.sort((a, b) => a._num - b._num).forEach(a => delete a._num)
  return { acts, extras }
}
