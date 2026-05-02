'use strict'

const { sendNtfy } = require('./_ntfy')
const { getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { ntfyTopic, productionTitle } = body
  if (!ntfyTopic) return err('ntfyTopic required', 400, origin)

  try {
    await sendNtfy(ntfyTopic, `✅ ${productionTitle || 'Your production'} — Ovature™ alerts are working! You'll receive cast check-in updates here on show day.`, {
      title: '🎭 Ovature™ — Test',
      priority: 'default',
      tags: ['tada']
    })
    return ok({ success: true }, origin)
  } catch (e) {
    return err('Failed to send: ' + e.message, 500, origin)
  }
}
