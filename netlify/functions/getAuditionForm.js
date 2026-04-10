'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')
const { REGISTRY_SHEET_ID } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const { productionCode } = event.queryStringParameters || {}
  if (!productionCode) return err('productionCode required')

  try {
    const sheets = await sheetsClient()
    const regRows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (regRows.length < 2) return err('Production not found', 404)
    const [rh, ...rd] = regRows
    const codeIdx = rh.indexOf('productionCode')
    const sheetIdx = rh.indexOf('sheetId')
    const row = rd.find(r => r[codeIdx] === productionCode.toUpperCase())
    if (!row) return err('Production not found', 404)
    const sheetId = row[sheetIdx]

    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { try { config[k] = JSON.parse(v) } catch { config[k] = v || '' } })

    if (config.useAuditions !== true && config.useAuditions !== 'true') {
      return err('Auditions not enabled for this production', 404)
    }

    return ok({
      sheetId,
      productionTitle: config.title || '',
      directorName: config.directorName || '',
      directorEmail: config.directorEmail || '',
      headshotFolderId: config.headshotFolderId || '',
      auditionQuestions: config.auditionQuestions || []
    })
  } catch (e) {
    console.error(e)
    return err('Failed: ' + e.message, 500)
  }
}
