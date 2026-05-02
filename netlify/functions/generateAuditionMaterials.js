'use strict'

const { getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { showTitle, requestType } = body
  if (!showTitle) return err('showTitle required', 400, origin)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return err('ANTHROPIC_API_KEY not configured', 500, origin)

  const prompts = {
    sides: `You are a theater director preparing audition materials for "${showTitle}". Provide 3-4 suggested audition sides that would work well for this show. For each include: character name, scene description, why it works for auditions, approximate length.`,
    monologues: `Suggest 4-5 contrasting monologues from other shows for auditioning for roles in "${showTitle}". For each: show title, character, description, what it tests in the actor, approximate length.`,
    vocal: `Vocal audition guide for "${showTitle}": 1. Vocal ranges needed per character 2. Suggested 16-bar cuts 3. What qualities to listen for per role 4. Vocal challenges to watch for.`,
    schedule: `Create an audition day schedule template for "${showTitle}" school/community theater including: check-in, warm-up, individual slots with timing, callback structure, what materials auditioners should prepare.`
  }

  const prompt = prompts[requestType] || prompts.sides

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
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
      req.setTimeout(24000, () => { req.destroy(); reject(new Error('Request timed out')) })
      req.write(requestBody)
      req.end()
    })

    let parsed
    try { parsed = JSON.parse(response.body) }
    catch (e) { return err('Invalid API response', 500, origin) }

    if (response.status >= 400) {
      return err(parsed.error?.message || 'API error ' + response.status, 500, origin)
    }

    const content = parsed.content?.[0]?.text || ''
    return ok({ content, requestType }, origin)

  } catch (e) {
    console.error('Error:', e.message)
    return err(e.message, 500, origin)
  }
}
