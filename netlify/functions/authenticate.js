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

  const { productionCode, pin, newPin } = body
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
      // Check SharedWith tab — PIN login OR invite code login
      const sheetId = row[sheetIdx]
      const sharedRows = await getRows(sheets, sheetId, 'SharedWith!A:F')

      if (sharedRows.length > 1) {
        const [sh, ...sdata] = sharedRows
        const nameIdx = sh.indexOf('name')
        const emailIdx = sh.indexOf('email')
        const phIdx = sh.indexOf('pinHash')
        const inviteIdx = sh.indexOf('inviteCode')
        const activatedIdx = sh.indexOf('activated')
        const roleIdx = sh.indexOf('role')

        // Try PIN match first
        let sharedRow = sdata.find(r => r[phIdx] && r[phIdx] === pinHash)
        let rowIndex = sdata.indexOf(sharedRow)

        if (sharedRow) {
          const memberRole = roleIdx >= 0 && sharedRow[roleIdx] === 'admin' ? 'admin' : 'shared'
          return ok({
            productionCode: productionCode.toUpperCase(),
            title: row[titleIdx],
            sheetId,
            role: memberRole,
            name: sharedRow[nameIdx] || '',
            email: sharedRow[emailIdx] || ''
          })
        }

        // Try invite code match (pin field used as invite code entry)
        const inviteUpper = pin.toUpperCase()
        sharedRow = sdata.find(r =>
          r[inviteIdx] === inviteUpper && r[activatedIdx] !== 'true'
        )
        rowIndex = sdata.indexOf(sharedRow)

        if (sharedRow) {
          if (!newPin) {
            // Invite code valid — prompt user to set PIN
            return ok({
              status: 'invite_valid',
              productionCode: productionCode.toUpperCase(),
              title: row[titleIdx],
              sheetId,
              name: sharedRow[nameIdx] || '',
              email: sharedRow[emailIdx] || '',
              inviteCode: inviteUpper
            })
          }

          // newPin provided — activate account
          if (newPin.length < 4) return err('PIN must be at least 4 characters')

          const newPinHash = hashPin(newPin)
          const sheetRowIndex = rowIndex + 2 // +1 header, +1 1-based

          // Update the row: set pinHash, clear inviteCode, mark activated
          const updatedRow = [...sharedRow]
          while (updatedRow.length < 6) updatedRow.push('')
          updatedRow[phIdx] = newPinHash
          updatedRow[inviteIdx] = '' // consume invite code
          updatedRow[activatedIdx] = 'true'

          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `SharedWith!A${sheetRowIndex}:F${sheetRowIndex}`,
            valueInputOption: 'RAW',
            requestBody: { values: [updatedRow] }
          })

          const activatedRole = roleIdx >= 0 && sharedRow[roleIdx] === 'admin' ? 'admin' : 'shared'
          return ok({
            productionCode: productionCode.toUpperCase(),
            title: row[titleIdx],
            sheetId,
            role: activatedRole,
            name: sharedRow[nameIdx] || '',
            email: sharedRow[emailIdx] || ''
          })
        }
      }

      return err('Incorrect PIN or invite code', 401)
    }

    // Admin/member — pull director info from config
    let directorName = ''
    let directorEmail = ''
    try {
      const configRows = await getRows(sheets, row[sheetIdx], 'Config!A:B')
      const nameRow = configRows.find(r => r[0] === 'directorName')
      const emailRow = configRows.find(r => r[0] === 'directorEmail')
      if (nameRow) directorName = nameRow[1] || ''
      if (emailRow) directorEmail = emailRow[1] || ''
    } catch (e) {
      console.warn('Could not read director info:', e.message)
    }

    return ok({
      productionCode: productionCode.toUpperCase(),
      title: row[titleIdx],
      sheetId: row[sheetIdx],
      role: isAdmin ? 'admin' : 'member',
      name: directorName,
      email: directorEmail
    })
  } catch (e) {
    console.error(e)
    return err('Authentication failed: ' + e.message, 500)
  }
}
