'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const sheetId = event.queryStringParameters && event.queryStringParameters.sheetId
  if (!sheetId) return err('sheetId required')

  try {
    const sheets = await sheetsClient()
    const rows = await getRows(sheets, sheetId, 'Notes!A:P')
    if (rows.length < 2) return ok({ notes: [] })

    const [header, ...data] = rows
    const idx = {}
    header.forEach((col, i) => { idx[col] = i })

    const notes = data
      .filter(r => r[idx.deleted] !== 'true' && r.some(Boolean))
      .map(r => ({
        id: r[idx.id] || '',
        date: r[idx.date] || '',
        scene: r[idx.scene] || '',
        category: r[idx.category] || '',
        priority: r[idx.priority] || 'med',
        cast: r[idx.cast] || '',
        cue: r[idx.cue] || '',
        swTime: r[idx.swTime] || '',
        text: r[idx.text] || '',
        resolved: r[idx.resolved] === 'true',
        createdAt: r[idx.createdAt] || '',
        updatedAt: r[idx.updatedAt] || '',
        createdBy: r[idx.createdBy] || '',
        carriedOver: r[idx.carriedOver] || 'false',
        attachmentUrl: r[idx.attachmentUrl] || ''
      }))
      .reverse()

    return ok({ notes })
  } catch (e) {
    console.error(e)
    return err('Failed to load notes: ' + e.message, 500)
  }
}
