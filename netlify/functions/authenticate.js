'use strict'

const {
  sheetsClient, getRows, hashPin,
  REGISTRY_SHEET_ID, CORS, ok, err
} = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { productionCode, pin } = body
  if (!productionCode || !pin) return err('Production code and PIN are required')

  try {
    const sheets = await sheetsClient()
    const rows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (rows.length < 2) return err('Production not found', 404)

    const [header, ...data] = rows
    const codeIdx = header.indexOf('productionCode')
    const titleIdx = header.indexOf('title')
    const sheetIdx = header.indexOf('sheetId')
    const pinIdx = header.indexOf('pinHash')
    const adminPinIdx = header.indexOf('adminPinHash')

    const row = data.find(r => r[codeIdx] === productionCode.toUpperCase())
    if (!row) return err('Production not found', 404)

    const pinHash = hashPin(pin)
    const isAdmin = pinHash === row[adminPinIdx]
    const isMember = pinHash === row[pinIdx]

    if (!isAdmin && !isMember) {
      // Also check SharedWith tab of the production sheet
      const sheetId = row[sheetIdx]
      const sharedRows = await getRows(sheets, sheetId, 'SharedWith!A:C')
      if (sharedRows.length > 1) {
        const [sh, ...sdata] = sharedRows
        const phIdx = sh.indexOf('pinHash')
        const nameIdx = sh.indexOf('name')
        const emailIdx = sh.indexOf('email')
        const sharedRow = sdata.find(r => r[phIdx] === pinHash)
        if (sharedRow) {
          return ok({
            productionCode: productionCode.toUpperCase(),
            title: row[titleIdx],
            sheetId: row[sheetIdx],
            role: 'shared',
            name: sharedRow[nameIdx] || '',
            email: sharedRow[emailIdx] || ''
          })
        }
      }
      return err('Incorrect PIN', 401)
    }

    return ok({
      productionCode: productionCode.toUpperCase(),
      title: row[titleIdx],
      sheetId: row[sheetIdx],
      role: isAdmin ? 'admin' : 'member'
    })
  } catch (e) {
    console.error(e)
    return err('Authentication failed: ' + e.message, 500)
  }
}
