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

  // Short prompts to stay within 10s Netlify free tier timeout
  const prompts = {
    sides: `List 3 audition sides for "${showTitle}" - character, scene description, why it works, length. Be concise.`,
    monologues: `Suggest 4 contrasting monologues from other shows for auditioning for "${showTitle}". Show, character, what it tests. Be concise.`,
    vocal: `Vocal audition guide for "${showTitle}": ranges per character, 16-bar cut suggestions, what to listen for. Be concise.`,
    schedule: `Audition day schedule template for "${showTitle}" school/community theater production. Include timings. Be concise.`
  }

  const prompt = prompts[requestType] || prompts.sides

  try {
    const requestBody = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',  // Haiku is much faster
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
      req.setTimeout(9000, () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(requestBody)
      req.end()
    })

    let parsed
    try { parsed = JSON.parse(response.body) }
    catch (e) { return err('Invalid API response', 500) }

    if (response.status >= 400) {
      return err(parsed.error?.message || 'API error ' + response.status, 500)
    }

    const content = parsed.content?.[0]?.text || ''
    return ok({ content, requestType })

  } catch (e) {
    console.error('Error:', e.message)
    return err(e.message, 500)
  }
}
