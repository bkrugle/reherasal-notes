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

  const prompt = `List the named characters/roles from the musical or play "${showTitle}".

Return ONLY a JSON array of character names, nothing else. No explanation, no markdown, no backticks.
Order them from most prominent to least prominent.
Include all named roles including smaller parts but exclude generic ensemble/chorus labels.
Example format: ["Character One", "Character Two", "Character Three"]

If you don't recognize this as a specific show, return an empty array: []`

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
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
      req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(requestBody)
      req.end()
    })

    let parsed
    try { parsed = JSON.parse(response.body) } catch { return err('Invalid API response', 500) }
    if (response.status >= 400) return err(parsed.error?.message || 'API error', 500)

    const text = parsed.content?.[0]?.text || '[]'
    let characters
    try {
      characters = JSON.parse(text.trim())
      if (!Array.isArray(characters)) characters = []
    } catch {
      // Try to extract array from response if there's extra text
      const match = text.match(/\[[\s\S]*\]/)
      try { characters = match ? JSON.parse(match[0]) : [] } catch { characters = [] }
    }

    return ok({ characters, showTitle })
  } catch (e) {
    console.error('lookupShowCast error:', e.message)
    return err(e.message, 500)
  }
}
