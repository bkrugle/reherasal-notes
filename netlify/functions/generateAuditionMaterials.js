'use strict'

const { CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { showTitle, requestType } = body
  if (!showTitle) return err('showTitle required')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return err('ANTHROPIC_API_KEY not configured', 500)

  const prompts = {
    sides: `You are a theater director preparing audition materials for "${showTitle}". Provide 3-4 suggested audition sides (short scenes or monologues) that would work well for this show. For each, include: the character name, a brief description of the scene/moment, why it's good for auditions, and the approximate length. Format clearly with headers. Be specific to this show.`,
    monologues: `You are a theater director preparing auditions for "${showTitle}". Suggest 4-5 contrasting monologues from other shows that would work well to audition for roles in "${showTitle}". For each, include: show title, character, brief description of the monologue, what it tests in the actor, and approximate length. Format clearly. Consider the tone and style of "${showTitle}" when making suggestions.`,
    vocal: `You are a music director preparing vocal auditions for "${showTitle}". Provide guidance on: 1. Vocal ranges needed for the main characters (soprano, mezzo, baritone, bass, belt, etc.) 2. Suggested 16-bar cuts that would work well for this show's style 3. What vocal qualities to listen for in each major role 4. Any specific vocal challenges in the show directors should watch for. Be specific to "${showTitle}".`,
    schedule: `You are a stage manager planning audition day for "${showTitle}". Create a suggested audition day schedule template including: 1. Check-in and form completion 2. Group warm-up if applicable 3. Individual audition slots with suggested timing 4. Callback structure if needed 5. What materials auditioners should prepare. Keep it practical for a school/community theater production of "${showTitle}".`
  }

  const prompt = prompts[requestType] || prompts.sides

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    // Use node-fetch style with https module
    const response = await new Promise((resolve, reject) => {
      const https = require('https')
      const options = {
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
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data })
        })
      })

      req.on('error', reject)
      req.setTimeout(25000, () => {
        req.destroy()
        reject(new Error('Request timed out after 25s'))
      })
      req.write(requestBody)
      req.end()
    })

    console.log('Claude API status:', response.status)

    let parsed
    try {
      parsed = JSON.parse(response.body)
    } catch (e) {
      console.error('Failed to parse Claude response:', response.body.slice(0, 200))
      return err('Invalid response from Claude API', 500)
    }

    if (response.status >= 400) {
      console.error('Claude API error:', parsed)
      return err(parsed.error?.message || 'Claude API error: ' + response.status, 500)
    }

    const content = parsed.content?.[0]?.text || ''
    return ok({ content, requestType })

  } catch (e) {
    console.error('generateAuditionMaterials error:', e.message)
    return err('Failed to generate materials: ' + e.message, 500)
  }
}
