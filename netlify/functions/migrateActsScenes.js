'use strict'

// Migration endpoint: upgrade an existing production sheet to the new
// acts/scenes data model.
//
//   POST /api/migrateActsScenes  { sheetId }
//
// Idempotent — running it again on an already-migrated sheet is a no-op.
//
// Steps:
//   1. Read Config; if it's still the legacy flat-string scenes shape,
//      run migrateConfig and write the new acts/scenes back.
//   2. Read Notes header; if it doesn't have actId/sceneId columns,
//      extend the header to A:U.
//   3. Read all notes; for any note that still has a `scene` string but no
//      `sceneId`, look up the sceneId in the migrated config and write it
//      back to columns T,U.
//
// Returns a summary of what was changed.
// ---------------------------------------------------------------------------

const { sheetsClient, getRows, getCorsHeaders, ok, err } = require('./_sheets')
const { migrateConfig, migrateNote, isLegacyConfig } = require('./_actsScenes')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }
  const { sheetId } = body
  if (!sheetId) return err('sheetId required', 400, origin)

  const summary = {
    configMigrated: false,
    actsCreated: 0,
    scenesConverted: 0,
    notesHeaderExtended: false,
    notesMigrated: 0,
    notesUntouched: 0,
    notesUnmatched: 0
  }

  try {
    const sheets = await sheetsClient()

    // ---- Step 1: Migrate Config ------------------------------------------
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => {
      if (!k) return
      try { config[k] = JSON.parse(v) } catch { config[k] = v || '' }
    })

    let migratedConfig = config
    if (isLegacyConfig(config)) {
      migratedConfig = migrateConfig(config)
      summary.configMigrated = true
      summary.actsCreated = migratedConfig.acts.length
      summary.scenesConverted = migratedConfig.scenes.length

      // Write only the two changed keys to avoid clobbering anything else
      const updates = []
      configRows.forEach((row, i) => {
        const k = row[0]
        if (k === 'scenes') updates.push({ row: i + 1, value: JSON.stringify(migratedConfig.scenes) })
      })
      // 'acts' may not exist as a key yet — append if missing
      const hasActs = configRows.some(r => r[0] === 'acts')
      if (!hasActs) {
        const newRow = configRows.length + 1
        updates.push({ row: newRow, key: 'acts', value: JSON.stringify(migratedConfig.acts) })
      } else {
        configRows.forEach((row, i) => {
          if (row[0] === 'acts') updates.push({ row: i + 1, value: JSON.stringify(migratedConfig.acts) })
        })
      }

      for (const u of updates) {
        const range = `Config!A${u.row}:B${u.row}`
        const values = u.key ? [[u.key, u.value]] : [[configRows[u.row - 1][0], u.value]]
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId, range, valueInputOption: 'RAW', requestBody: { values }
        })
      }
    } else if (!Array.isArray(config.acts)) {
      // Has new-shape scenes but no acts array — shouldn't happen, but seed defaults
      migratedConfig = migrateConfig(config)
    }

    // ---- Step 2: Extend Notes header if needed ---------------------------
    const headerRows = await getRows(sheets, sheetId, 'Notes!A1:U1')
    const header = headerRows[0] || []
    const hasActId = header.includes('actId')
    const hasSceneId = header.includes('sceneId')

    if (!hasActId || !hasSceneId) {
      // Pad header to length 21 and ensure positions 19,20 are actId,sceneId
      // (also ensure pinnedBy is at index 18 — it should be in current sheets)
      const newHeader = [
        'id','date','scene','category','priority','cast','cue','swTime','text',
        'resolved','createdAt','updatedAt','createdBy','deleted','carriedOver',
        'attachmentUrl','pinned','privateNote','pinnedBy','actId','sceneId'
      ]
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: 'Notes!A1:U1', valueInputOption: 'RAW',
        requestBody: { values: [newHeader] }
      })
      summary.notesHeaderExtended = true
    }

    // ---- Step 3: Migrate notes -------------------------------------------
    const notesRows = await getRows(sheets, sheetId, 'Notes!A:U')
    if (notesRows.length > 1) {
      const [hdr, ...data] = notesRows
      const idx = {}
      hdr.forEach((c, i) => { idx[c] = i })

      const updates = []
      data.forEach((row, i) => {
        if (!row.some(Boolean)) return  // skip empty rows
        const existingActId = row[idx.actId] || ''
        const existingSceneId = row[idx.sceneId] || ''
        if (existingActId || existingSceneId) {
          summary.notesUntouched++
          return
        }
        // Build a partial note object for the migrator
        const partial = { scene: row[idx.scene] || '' }
        const migrated = migrateNote(partial, migratedConfig)
        if (!migrated.actId && !migrated.sceneId) {
          summary.notesUnmatched++
          return
        }
        // Pad row to width 21
        const newRow = [...row]
        while (newRow.length < 21) newRow.push('')
        newRow[19] = migrated.actId || ''   // T: actId
        newRow[20] = migrated.sceneId || '' // U: sceneId
        updates.push({ rowIndex: i + 2, values: newRow })
        summary.notesMigrated++
      })

      // Batch the writes — one per row, but using a single batchUpdate call
      if (updates.length) {
        const data = updates.map(u => ({
          range: `Notes!A${u.rowIndex}:U${u.rowIndex}`,
          values: [u.values]
        }))
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: { valueInputOption: 'RAW', data }
        })
      }
    }

    return ok({ success: true, summary }, origin)
  } catch (e) {
    console.error('migrateActsScenes error:', e.message)
    return err('Migration failed: ' + e.message, 500, origin)
  }
}
