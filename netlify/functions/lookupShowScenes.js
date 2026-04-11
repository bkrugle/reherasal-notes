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

  const prompt = `List the scenes/sections for the musical or play "${showTitle}" as a director would use them for rehearsal notes.

Return ONLY a JSON array of scene names, nothing else. No explanation, no markdown, no backticks.
Include acts, scenes, and major musical numbers that would be rehearsed separately.
Use the format directors actually use (e.g. "Act 1", "Act 1, Scene 2", "Opening Number", "Finale").
Also include useful generic entries like "Full Run", "Bows", "Pit Rehearsal".
Keep it practical — 15-25 entries max.
Example format: ["Act 1", "Act 1, Scene 1", "Opening Number", "Act 2", "Finale", "Full Run", "Bows"]

If you don't recognize this as a specific show, return a generic list: ["Act 1", "Act 2", "Full Run", "Bows", "Pit Rehearsal"]`

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
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
      req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(requestBody); req.end()
    })

    let parsed
    try { parsed = JSON.parse(response.body) } catch { return err('Invalid API response', 500) }
    if (response.status >= 400) return err(parsed.error?.message || 'API error', 500)

    const text = parsed.content?.[0]?.text || '[]'
    let scenes
    try {
      scenes = JSON.parse(text.trim())
      if (!Array.isArray(scenes)) scenes = []
    } catch {
      const match = text.match(/\[[\s\S]*\]/)
      try { scenes = match ? JSON.parse(match[0]) : [] } catch { scenes = [] }
    }

    return ok({ scenes, showTitle })
  } catch (e) {
    console.error('lookupShowScenes error:', e.message)
    return err(e.message, 500)
  }
}
