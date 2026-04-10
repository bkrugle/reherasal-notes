'use strict'

const { CORS, ok, err } = require('./_sheets')
const https = require('https')

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => {
        const p = JSON.parse(d)
        if (res.statusCode >= 400) reject(new Error(p.error?.message || 'Claude API error'))
        else resolve(p.content?.[0]?.text || '')
      })
    })
    req.on('error', reject); req.write(body); req.end()
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { showTitle, requestType } = body
  if (!showTitle) return err('showTitle required')
  if (!process.env.ANTHROPIC_API_KEY) return err('ANTHROPIC_API_KEY not configured', 500)

  const prompts = {
    sides: `You are a theater director preparing audition materials for "${showTitle}". 
Provide 3-4 suggested audition sides (short scenes or monologues) that would work well for this show. 
For each, include: the character name, a brief description of the scene/moment, why it's good for auditions, and the approximate length.
Format clearly with headers. Be specific to this show.`,

    monologues: `You are a theater director preparing auditions for "${showTitle}".
Suggest 4-5 contrasting monologues from other shows that would work well to audition for roles in "${showTitle}".
For each, include: show title, character, brief description of the monologue, what it tests in the actor, and approximate length.
Format clearly. Consider the tone and style of "${showTitle}" when making suggestions.`,

    vocal: `You are a music director preparing vocal auditions for "${showTitle}".
Provide guidance on:
1. Vocal ranges needed for the main characters (soprano, mezzo, baritone, bass, belt, etc.)
2. Suggested 16-bar cuts that would work well for this show's style
3. What vocal qualities to listen for in each major role
4. Any specific vocal challenges in the show directors should watch for
Be specific to "${showTitle}".`,

    schedule: `You are a stage manager planning audition day for "${showTitle}".
Create a suggested audition day schedule template including:
1. Check-in and form completion (15-20 min)
2. Group warm-up (if applicable)
3. Individual audition slots with suggested timing
4. Callback structure if needed
5. Dance/movement call if applicable
6. What materials auditioners should prepare
Keep it practical and realistic for a school/community theater production of "${showTitle}".`
  }

  const prompt = prompts[requestType] || prompts.sides
  try {
    const result = await callClaude(prompt)
    return ok({ content: result, requestType })
  } catch (e) {
    console.error(e)
    return err('Failed to generate materials: ' + e.message, 500)
  }
}
