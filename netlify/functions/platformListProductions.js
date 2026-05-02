'use strict'

const { sheetsClient, getRows, verifyPin, REGISTRY_SHEET_ID, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  // Verify platform admin via header
  const platformPin = event.headers?.['x-platform-pin']
  if (!platformPin) return err('Platform PIN required', 401)

  let platformAdmins = []
  try { platformAdmins = JSON.parse(process.env.PLATFORM_ADMINS || '[]') } catch {}

  // Verify platform admin using bcrypt
  let admin = null
  for (const a of platformAdmins) {
    if (await verifyPin(platformPin, a.pin)) {
      admin = a
      break
    }
  }
  if (!admin) return err('Invalid platform PIN', 401)

  try {
    const sheets = await sheetsClient()
    const rows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (rows.length < 2) return ok({ productions: [] })

    const [header, ...data] = rows
    const codeIdx = header.indexOf('productionCode')
    const titleIdx = header.indexOf('title')
    const sheetIdx = header.indexOf('sheetId')

    const productions = await Promise.all(
      data
        .filter(r => r[codeIdx] && r.some(Boolean))
        .map(async r => {
          const productionCode = r[codeIdx] || ''
          const title = r[titleIdx] || ''
          const sheetId = r[sheetIdx] || ''

          // Get note count and config
          let noteCount = 0
          let directorName = ''
          let directorEmail = ''
          let showDates = ''
          let teamCount = 0

          try {
            const notesRows = await getRows(sheets, sheetId, 'Notes!A:A')
            noteCount = Math.max(0, notesRows.length - 1)
          } catch {}

          try {
            const configRows = await getRows(sheets, sheetId, 'Config!A:B')
            const config = {}
            configRows.forEach(([k, v]) => { if (k) config[k] = v })
            directorName = config.directorName || ''
            directorEmail = config.directorEmail || ''
            showDates = config.showDates || ''
          } catch {}

          try {
            const teamRows = await getRows(sheets, sheetId, 'SharedWith!A:A')
            teamCount = Math.max(0, teamRows.length - 1)
          } catch {}

          return { productionCode, title, sheetId, directorName, directorEmail, showDates, noteCount, teamCount }
        })
    )

    return ok({ productions })
  } catch (e) {
    console.error(e)
    return err('Failed to load productions: ' + e.message, 500)
  }
}
