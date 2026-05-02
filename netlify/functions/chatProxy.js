'use strict'

const https = require('https')
const { getCorsHeaders } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: 'Method not allowed' }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: corsHeaders, body: 'Invalid JSON' }
  }

  const { messages, system } = body
  if (!messages) return { statusCode: 400, headers: corsHeaders, body: 'messages required' }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system,
    messages,
  })

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      }
    }, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: data
        })
      })
    })
    req.on('error', e => {
      resolve({ statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) })
    })
    req.write(payload)
    req.end()
  })
}
