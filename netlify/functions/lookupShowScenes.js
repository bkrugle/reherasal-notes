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

  // Anti-hallucination prompt:
  //  - Heavy emphasis on accuracy over completeness
  //  - Explicit instruction to refuse when uncertain instead of guessing
  //  - Examples of common failure modes (mixing shows, using show title as scene)
  //  - Sets `confident: false` flag if uncertain so caller can warn user
  const prompt = `You are helping organize a director's rehearsal notes for a stage production. The show is: "${showTitle}".

Your job: list the SONGS, SCENES, and ACTS of this specific show — and ONLY this show. Accuracy matters far more than completeness. It is much better to return 5 verified items than 20 with hallucinations.

Return ONLY valid JSON, nothing else (no markdown, no backticks, no commentary):
{
  "confident": true,
  "acts": [
    { "name": "Act 1", "scenes": ["Song A", "Song B"] },
    { "name": "Act 2", "scenes": ["Song C"] }
  ],
  "extras": ["Bows", "Full Run"]
}

CRITICAL RULES:
1. ONLY include songs/scenes you are CERTAIN belong to "${showTitle}". If you're unsure about a song, OMIT it.
2. NEVER invent scene names. NEVER mix in songs from other shows (this is a common error — be vigilant).
3. The show title itself is NOT a scene. Don't include "${showTitle}" as a scene name.
4. If you do not have confident knowledge of this show's structure, set "confident": false and return mostly empty arrays:
   { "confident": false, "acts": [{"name":"Act 1","scenes":[]},{"name":"Act 2","scenes":[]}], "extras": ["Bows","Full Run"] }
5. Use the EXACT song titles as they appear in the score/script. Don't paraphrase.
6. Place songs in the act where they actually appear (Act 1 vs Act 2). If unsure of placement, set "confident": false.
7. "extras" is for production-process items that aren't part of the show itself: "Bows", "Curtain Call", "Full Run", "Pit Rehearsal", "Sitzprobe", "Tech Run". Do NOT put songs here.
8. Most musicals have 2 acts. Most plays have 1-3 acts. Use what's accurate for this show.
9. Quality over quantity. A confident 8-item list beats a hallucinated 20-item one.

Common mistakes to avoid:
- Mixing songs from "${showTitle}" with songs from other similarly-themed shows
- Including the show title as a scene
- Inventing plausible-sounding song names
- Splitting compound numbers ("Pandemonium / Reprise") that aren't actually two scenes`

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
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

    let structured = null
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
    try {
      structured = JSON.parse(cleaned)
    } catch {
      const objMatch = cleaned.match(/\{[\s\S]*\}/)
      if (objMatch) { try { structured = JSON.parse(objMatch[0]) } catch {} }
    }

    if (!structured || !Array.isArray(structured.acts)) {
      structured = { confident: false, acts: [{ name: 'Act 1', scenes: [] }, { name: 'Act 2', scenes: [] }], extras: ['Full Run', 'Bows'] }
    }

    const isConfident = structured.confident !== false  // default true if unspecified

    // Normalize → assign stable IDs and order.
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
        const trimmed = String(name).trim()
        // Skip the show title accidentally being included as a scene
        if (trimmed.toLowerCase() === String(showTitle).toLowerCase()) return
        scenes.push({ id: newSceneId(), name: trimmed, actId, order: ++sceneOrder })
      })
    })

    const extras = Array.isArray(structured.extras) ? structured.extras : []
    extras.forEach((s) => {
      const name = (typeof s === 'string') ? s : (s && s.name)
      if (!name) return
      scenes.push({ id: newSceneId(), name: String(name).trim(), actId: null, order: ++sceneOrder })
    })

    const flat = scenes.map(s => s.name)

    return ok({
      scenes: flat,
      scenes_struct: scenes,
      acts,
      confident: isConfident,
      showTitle
    })
  } catch (e) {
    console.error('lookupShowScenes error:', e.message)
    return err(e.message, 500)
  }
}
