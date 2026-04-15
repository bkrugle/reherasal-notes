'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')

// Department tags that should populate the cast field
const DEPARTMENT_TAGS = {
  lights: 'lights',
  lighting: 'lights',
  sound: 'sound',
  audio: 'sound',
  costumes: 'costumes',
  costume: 'costumes',
  wardrobe: 'costumes',
  props: 'props',
  prop: 'props',
  set: 'set',
}

// Category tags (same as hashtags.js)
const CATEGORY_TAGS = {
  blocking: 'blocking', block: 'blocking',
  performance: 'performance', perf: 'performance', acting: 'performance',
  music: 'music', vocals: 'music', vocal: 'music', singing: 'music',
  technical: 'technical', tech: 'technical',
  lights: 'technical', lighting: 'technical', sound: 'technical', audio: 'technical',
  costume: 'costume', costumes: 'costume', wardrobe: 'costume',
  set: 'set', props: 'set', prop: 'set', preset: 'set',
  general: 'general',
}

function extractDepartmentsFromText(text) {
  if (!text) return []
  const departments = []
  const tagPattern = /#([a-zA-Z0-9_]+)/g
  let match
  while ((match = tagPattern.exec(text)) !== null) {
    const lower = match[1].toLowerCase()
    if (DEPARTMENT_TAGS[lower] && !departments.includes(DEPARTMENT_TAGS[lower])) {
      departments.push(DEPARTMENT_TAGS[lower])
    }
  }
  return departments
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId } = body
  if (!sheetId) return err('sheetId required')

  try {
    const sheets = await sheetsClient()
    const rows = await getRows(sheets, sheetId, 'Notes!A:R')
    if (rows.length < 2) return ok({ updated: 0, message: 'No notes found' })

    const [header, ...data] = rows
    const idx = {}
    header.forEach((col, i) => { idx[col] = i })

    let updated = 0
    const updates = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (row[idx.deleted] === 'true' || !row.some(Boolean)) continue

      const text = row[idx.text] || ''
      const existingCast = row[idx.cast] || ''

      // Extract department tags from text
      const departments = extractDepartmentsFromText(text)
      if (departments.length === 0) continue

      // Merge with existing cast values
      const existingValues = existingCast
        ? existingCast.split(',').map(s => s.trim()).filter(Boolean)
        : []
      const merged = [...new Set([...existingValues, ...departments])]
      const newCast = merged.join(', ')

      // Only update if cast field would change
      if (newCast === existingCast) continue

      const updatedRow = [...row]
      while (updatedRow.length < 18) updatedRow.push('')
      updatedRow[idx.cast] = newCast
      updatedRow[idx.updatedAt] = new Date().toISOString()

      const sheetRowIndex = i + 2
      updates.push({
        range: `Notes!A${sheetRowIndex}:R${sheetRowIndex}`,
        values: [updatedRow]
      })
      updated++
    }

    // Batch update all changed rows
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      })
    }

    return ok({
      success: true,
      updated,
      message: `Updated ${updated} note${updated !== 1 ? 's' : ''} with department tags`
    })
  } catch (e) {
    console.error(e)
    return err('Migration failed: ' + e.message, 500)
  }
}
