'use strict'

const { sheetsClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }

  const sheetId = event.queryStringParameters && event.queryStringParameters.sheetId
  if (!sheetId) return err('sheetId required', 400, origin)

  try {
    const sheets = await sheetsClient()
    // Read full width A:U (21 cols) — accommodates new actId/sceneId columns.
    // Legacy sheets that only have A:S (19 cols) still work; the extra
    // columns simply come back as undefined and we map them to null.
    const rows = await getRows(sheets, sheetId, 'Notes!A:U')
    if (rows.length < 2) return ok({ notes: [] }, origin)

    const [header, ...data] = rows
    const idx = {}
    header.forEach((col, i) => { idx[col] = i })

    // Helper to safely get a column value when the column may not exist
    function col(row, name) {
      const i = idx[name]
      return (i === undefined || i < 0) ? '' : (row[i] || '')
    }

    const notes = data
      .filter(r => r[idx.deleted] !== 'true' && r.some(Boolean))
      .map(r => ({
        id: col(r, 'id'),
        date: col(r, 'date'),
        scene: col(r, 'scene'),                 // legacy display field — kept for back-compat
        sceneId: col(r, 'sceneId') || null,     // NEW: stable scene reference
        actId: col(r, 'actId') || null,         // NEW: stable act reference
        category: col(r, 'category'),
        priority: col(r, 'priority') || 'med',
        cast: col(r, 'cast'),
        cue: col(r, 'cue'),
        swTime: col(r, 'swTime'),
        text: col(r, 'text'),
        resolved: col(r, 'resolved') === 'true',
        createdAt: col(r, 'createdAt'),
        updatedAt: col(r, 'updatedAt'),
        createdBy: col(r, 'createdBy'),
        carriedOver: col(r, 'carriedOver') || 'false',
        attachmentUrl: col(r, 'attachmentUrl'),
        pinned: col(r, 'pinned') === 'true',
        privateNote: col(r, 'privateNote') === 'true',
        pinnedBy: col(r, 'pinnedBy')
      }))
      .reverse()

    return ok({ notes }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to load notes: ' + e.message, 500, origin)
  }
}
