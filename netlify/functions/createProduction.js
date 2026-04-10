'use strict'

const {
  sheetsClient, driveClient, getRows, appendRows,
  hashPin, makeProductionCode, REGISTRY_SHEET_ID, CORS, ok, err
} = require('./_sheets')

const SHARED_DRIVE_ID = '0AHO7QedLJaIHUk9PVA'

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { title, pin, adminPin, directorName, directorEmail, showDates, scenes, characters, staff } = body
  if (!title || !pin) return err('Title and PIN are required')
  if (pin.length < 4) return err('PIN must be at least 4 characters')

  try {
    const sheets = await sheetsClient()
    const drive = await driveClient()

    // 1. Create production root folder in Shared Drive
    const rootFolder = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [SHARED_DRIVE_ID]
      },
      fields: 'id'
    })
    const rootFolderId = rootFolder.data.id

    // 2. Create Note Attachments subfolder
    const attachFolder = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: 'Note Attachments',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId]
      },
      fields: 'id'
    })
    const attachFolderId = attachFolder.data.id

    // 3. Create Production Documents subfolder
    const docsFolder = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: 'Production Documents',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId]
      },
      fields: 'id'
    })
    const docsFolderId = docsFolder.data.id

    // 4. Create the production sheet inside root folder
    const driveFile = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: `Production Sheet — ${title}`,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [rootFolderId]
      },
      fields: 'id'
    })
    const productionSheetId = driveFile.data.id

    // 5. Set up sheet tabs
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: productionSheetId,
      requestBody: {
        requests: [
          { updateSheetProperties: { properties: { sheetId: 0, title: 'Notes' }, fields: 'title' } },
          { addSheet: { properties: { title: 'Config' } } },
          { addSheet: { properties: { title: 'SharedWith' } } }
        ]
      }
    })

    // 6. Notes header — includes attachmentUrl column
    await sheets.spreadsheets.values.update({
      spreadsheetId: productionSheetId,
      range: 'Notes!A1:P1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['id','date','scene','category','priority','cast','cue','swTime','text','resolved','createdAt','updatedAt','createdBy','deleted','carriedOver','attachmentUrl']]
      }
    })

    // 7. Config tab — includes folder IDs
    const configData = [
      ['title', title],
      ['directorName', directorName || ''],
      ['directorEmail', directorEmail || ''],
      ['showDates', showDates || ''],
      ['venue', ''],
      ['calendarId', ''],
      ['scenes', JSON.stringify(scenes || [])],
      ['characters', JSON.stringify(characters || [])],
      ['staff', JSON.stringify(staff || [])],
      ['rootFolderId', rootFolderId],
      ['attachFolderId', attachFolderId],
      ['docsFolderId', docsFolderId],
      ['createdAt', new Date().toISOString()]
    ]
    await sheets.spreadsheets.values.update({
      spreadsheetId: productionSheetId,
      range: 'Config!A1:B20',
      valueInputOption: 'RAW',
      requestBody: { values: configData }
    })

    // 8. SharedWith header
    await sheets.spreadsheets.values.update({
      spreadsheetId: productionSheetId,
      range: 'SharedWith!A1:C1',
      valueInputOption: 'RAW',
      requestBody: { values: [['name','email','pinHash']] }
    })

    // 9. Register in Registry
    const productionCode = makeProductionCode(title)
    const pinHash = hashPin(pin)
    const adminPinHash = adminPin ? hashPin(adminPin) : pinHash

    const registryRows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:A')
    if (registryRows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: REGISTRY_SHEET_ID,
        range: 'Registry!A1:F1',
        valueInputOption: 'RAW',
        requestBody: { values: [['productionCode','title','sheetId','pinHash','adminPinHash','createdAt']] }
      })
    }

    await appendRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F', [
      [productionCode, title, productionSheetId, pinHash, adminPinHash, new Date().toISOString()]
    ])

    return ok({ productionCode, message: 'Production created successfully' })
  } catch (e) {
    console.error(e)
    return err('Failed to create production: ' + e.message, 500)
  }
}
