'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')
const { REGISTRY_SHEET_ID } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const { token, productionCode } = event.queryStringParameters || {}
  if (!token || !productionCode) return err('token and productionCode required')

  try {
    const sheets = await sheetsClient()
    // Find sheetId from registry
    const regRows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (regRows.length < 2) return err('Production not found', 404)
    const [rh, ...rd] = regRows
    const codeIdx = rh.indexOf('productionCode')
    const sheetIdx = rh.indexOf('sheetId')
    const row = rd.find(r => r[codeIdx] === productionCode.toUpperCase())
    if (!row) return err('Production not found', 404)
    const sheetId = row[sheetIdx]

    // Find auditioner by token
    const rows = await getRows(sheets, sheetId, 'Auditioners!A:P')
    if (rows.length < 2) return err('Not found', 404)
    const [header, ...data] = rows
    const idx = {}; header.forEach((c, i) => { idx[c] = i })
    const audRow = data.find(r => r[idx.editToken] === token)
    if (!audRow) return err('Invalid or expired token', 404)

    // Get production config for questions
    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { try { config[k] = JSON.parse(v) } catch { config[k] = v || '' } })

    return ok({
      sheetId,
      productionTitle: config.title || '',
      auditionQuestions: config.auditionQuestions || [],
      auditioner: {
        id: audRow[idx.id] || '',
        firstName: audRow[idx.firstName] || '',
        lastName: audRow[idx.lastName] || '',
        email: audRow[idx.email] || '',
        phone: audRow[idx.phone] || '',
        grade: audRow[idx.grade] || '',
        age: audRow[idx.age] || '',
        experience: audRow[idx.experience] || '',
        conflicts: audRow[idx.conflicts] || '',
        customAnswers: (() => { try { return JSON.parse(audRow[idx.customAnswers] || '{}') } catch { return {} } })()
      }
    })
  } catch (e) {
    console.error(e)
    return err('Failed: ' + e.message, 500)
  }
}
