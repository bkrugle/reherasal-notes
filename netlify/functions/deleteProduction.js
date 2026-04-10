'use strict'

const {
  sheetsClient, driveClient, getRows,
  REGISTRY_SHEET_ID, CORS, ok, err
} = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { sheetId, productionCode } = body
  if (!sheetId || !productionCode) return err('sheetId and productionCode required')

  try {
    const sheets = await sheetsClient()
    const drive = await driveClient()

    // 1. Find the root folder ID from the production config
    let rootFolderId = null
    try {
      const configRows = await getRows(sheets, sheetId, 'Config!A:B')
      const rootRow = configRows.find(r => r[0] === 'rootFolderId')
      if (rootRow) rootFolderId = rootRow[1]
    } catch (e) {
      console.warn('Could not read config:', e.message)
    }

    // 2. Delete root folder (deletes everything inside it too)
    if (rootFolderId) {
      try {
        await drive.files.delete({ fileId: rootFolderId, supportsAllDrives: true })
      } catch (e) {
        console.warn('Could not delete root folder:', e.message)
        // Try deleting just the sheet if folder delete fails
        try {
          await drive.files.delete({ fileId: sheetId, supportsAllDrives: true })
        } catch (e2) {
          console.warn('Could not delete sheet:', e2.message)
        }
      }
    } else {
      // No folder structure — just delete the sheet
      try {
        await drive.files.delete({ fileId: sheetId, supportsAllDrives: true })
      } catch (e) {
        console.warn('Could not delete sheet:', e.message)
      }
    }

    // 3. Remove from Registry
    const rows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (rows.length > 1) {
      const [header, ...data] = rows
      const codeIdx = header.indexOf('productionCode')
      const rowIndex = data.findIndex(r => r[codeIdx] === productionCode)
      if (rowIndex !== -1) {
        // Clear the row (can't delete rows easily, so blank it out)
        const sheetRowIndex = rowIndex + 2
        await sheets.spreadsheets.values.update({
          spreadsheetId: REGISTRY_SHEET_ID,
          range: `Registry!A${sheetRowIndex}:F${sheetRowIndex}`,
          valueInputOption: 'RAW',
          requestBody: { values: [['', '', '', '', '', '']] }
        })
      }
    }

    return ok({ deleted: true })
  } catch (e) {
    console.error(e)
    return err('Failed to delete production: ' + e.message, 500)
  }
}
