'use strict'

const { sheetsClient, driveClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')
const https = require('https')

// Fetch image from URL and return base64
async function fetchImageBase64(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url)
      const proto = urlObj.protocol === 'https:' ? https : require('http')
      proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchImageBase64(res.headers.location).then(resolve)
          return
        }
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
        res.on('error', () => resolve(null))
      }).on('error', () => resolve(null))
    } catch { resolve(null) }
  })
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { sheetId, productionTitle, useAuditions } = body
  if (!sheetId) return err('sheetId required', 400, origin)

  try {
    const sheets = await sheetsClient()

    // Load config for cast list and show info
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { try { config[k] = JSON.parse(v) } catch { config[k] = v || '' } })

    let castMembers = []

    if (useAuditions) {
      // Use auditioner records
      const audRows = await getRows(sheets, sheetId, 'Auditioners!A:P')
      if (audRows.length > 1) {
        const [header, ...data] = audRows
        const idx = {}; header.forEach((c, i) => { idx[c] = i })
        castMembers = data
          .filter(r => r[idx.role] && r[idx.deleted] !== 'true' && r.some(Boolean))
          .map(r => ({
            name: `${r[idx.firstName] || ''} ${r[idx.lastName] || ''}`.trim(),
            role: r[idx.role] || '',
            email: r[idx.email] || '',
            phone: r[idx.phone] || '',
            grade: r[idx.grade] || '',
            headshotUrl: r[idx.headshotUrl] || '',
          }))
      }
    }

    // Also include manually-entered characters (fills gaps + supports non-audition productions)
    const chars = Array.isArray(config.characters) ? config.characters : []
    chars.forEach(c => {
      const name = typeof c === 'string' ? c : c.name || ''
      const email = typeof c === 'object' ? (c.emails || [])[0] || '' : ''
      const phone = typeof c === 'object' ? c.phone || '' : ''
      const castMemberName = typeof c === 'object' ? c.castMember || '' : ''
      if (name && !castMembers.find(m => m.name === name)) {
        castMembers.push({ name, role: castMemberName, email, phone, grade: '', headshotUrl: '' })
      }
    })

    castMembers.sort((a, b) => a.name.localeCompare(b.name))

    // Build HTML that will be returned for client-side PDF generation
    // We return structured data and let the client render it
    return ok({
      productionTitle: productionTitle || config.title || 'Production',
      showDates: config.showDates || '',
      venue: config.venue || '',
      castMembers
    }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed: ' + e.message, 500, origin)
  }
}
