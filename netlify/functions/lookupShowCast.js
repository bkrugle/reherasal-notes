'use strict'

const { CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { showTitle } = body
  if (!showTitle) return err('showTitle required')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return err('ANTHROPIC_API_KEY not configured', 500)

  // Anti-hallucination prompt mirroring lookupShowScenes:
  //   - Accuracy over completeness
  //   - Explicit refusal-when-uncertain instead of guessing
  //   - confident: false flag when unsure
  const prompt = `You are helping a director set up casting for a stage production. The show is: "${showTitle}".

Your job: list the named characters/roles of this specific show — and ONLY this show. Accuracy matters far more than completeness. It is much better to return 5 verified characters than 15 with hallucinations.

Return ONLY valid JSON, nothing else (no markdown, no backticks, no commentary):
{
  "confident": true,
  "characters": ["Character One", "Character Two"]
}

CRITICAL RULES:
1. ONLY include characters you are CERTAIN belong to "${showTitle}". If you're unsure about a character, OMIT it.
2. NEVER invent character names. NEVER mix in characters from other shows (this is a common error — be vigilant).
3. The show title itself is NOT a character. Don't include "${showTitle}" as a character name.
4. If you do not have confident knowledge of this show's cast, set "confident": false and return an empty array:
   { "confident": false, "characters": [] }
5. Use the EXACT character names as they appear in the script. Don't paraphrase.
6. Order from most prominent to least prominent (leads first, supporting roles after).
7. Include all NAMED roles — even smaller parts. EXCLUDE generic ensemble/chorus labels (e.g. "Ensemble", "Chorus", "Townspeople").
8. Quality over quantity. A confident 6-character list beats a hallucinated 15-character one.

Common mistakes to avoid:
- Mixing characters from "${showTitle}" with similarly-themed shows
- Including the show title as a character
- Inventing plausible-sounding character names
- Including generic group labels like "Ensemble" or "Children's Chorus"`

  try {
    const requestBody = JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    const response = await new Promise((resolve, reject) => {
      const https = require('https')
      const req = https.request({
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(requestBody)
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve({ status: res.statusCode, body: data }))
      })
      req.on('error', reject)
      req.setTimeout(28000, () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(requestBody)
      req.end()
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
      // Last-resort: try the legacy flat-array shape
      if (!structured) {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/)
        if (arrMatch) {
          try {
            const arr = JSON.parse(arrMatch[0])
            if (Array.isArray(arr)) structured = { confident: true, characters: arr }
          } catch {}
        }
      }
    }

    if (!structured || !Array.isArray(structured.characters)) {
      structured = { confident: false, characters: [] }
    }

    const isConfident = structured.confident !== false  // default true if unspecified

    // Filter out the show title accidentally included as a character
    const characters = structured.characters
      .map(c => (typeof c === 'string' ? c : (c && c.name)) || '')
      .map(s => s.trim())
      .filter(Boolean)
      .filter(name => name.toLowerCase() !== String(showTitle).toLowerCase())

    return ok({ characters, confident: isConfident, showTitle })
  } catch (e) {
    console.error('lookupShowCast error:', e.message)
    return err(e.message, 500)
  }
}
