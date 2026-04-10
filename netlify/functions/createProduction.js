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

    // Create the sheet inside the Shared Drive
    const driveFile = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: `Rehearsal Notes — ${title}`,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [SHARED_DRIVE_ID]
      },
      fields: 'id'
    })
    const productionSheetId = driveFile.data.id

    // Rename Sheet1 to Notes, add Config and SharedWith tabs
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

    // Set up Notes header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: productionSheetId,
      range: 'Notes!A1:N1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['id','date','scene','category','priority','cast','cue','swTime','text','resolved','createdAt','updatedAt','createdBy','deleted']]
      }
    })

    // Set up Config tab
    const configData = [
      ['title', title],
      ['directorName', directorName || ''],
      ['directorEmail', directorEmail || ''],
      ['showDates', showDates || ''],
      ['scenes', JSON.stringify(scenes || [])],
      ['characters', JSON.stringify(characters || [])],
      ['staff', JSON.stringify(staff || [])],
      ['createdAt', new Date().toISOString()]
    ]
    await sheets.spreadsheets.values.update({
      spreadsheetId: productionSheetId,
      range: 'Config!A1:B20',
      valueInputOption: 'RAW',
      requestBody: { values: configData }
    })

    // Set up SharedWith header
    await sheets.spreadsheets.values.update({
      spreadsheetId: productionSheetId,
      range: 'SharedWith!A1:C1',
      valueInputOption: 'RAW',
      requestBody: { values: [['name','email','pinHash']] }
    })

    // Register in the Registry sheet
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
