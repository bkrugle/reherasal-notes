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
    await sendNtfy(ntfyTopic, `👋 Test notification from Rehearsal Notes! Your alerts for ${productionTitle || 'your production'} are working perfectly.`, {
      title: '🎭 Rehearsal Notes',
      priority: 'default',
      tags: ['tada']
    })
    return ok({ success: true })
  } catch (e) {
    return err('Failed to send: ' + e.message, 500)
  }
}
