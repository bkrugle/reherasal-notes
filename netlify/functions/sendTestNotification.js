'use strict'

const { sendNtfy } = require('./_ntfy')
const { CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { ntfyTopic, productionTitle } = body
  if (!ntfyTopic) return err('ntfyTopic required')

  try {
    await sendNtfy(ntfyTopic, `✅ ${productionTitle || 'Your production'} — Ovature alerts are working! You'll receive cast check-in updates here on show day.`, {
      title: '🎭 Ovature — Test',
      priority: 'default',
      tags: ['tada']
    })
    return ok({ success: true })
  } catch (e) {
    return err('Failed to send: ' + e.message, 500)
  }
}
