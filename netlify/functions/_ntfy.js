'use strict'

const https = require('https')

/**
 * Send a push notification via ntfy.sh
 * Free, no registration, no app cost for recipients
 * Topic is the "password" — keep it long and random
 */
async function sendNtfy(topic, message, options = {}) {
  if (!topic) throw new Error('No ntfy topic')

  const { title = 'Rehearsal Notes', priority = 'default', tags = [] } = options

  const body = JSON.stringify({
    topic,
    message,
    title,
    priority,
    tags
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'ntfy.sh',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`ntfy error ${res.statusCode}: ${data}`))
        else resolve(JSON.parse(data))
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('ntfy timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { sendNtfy }
