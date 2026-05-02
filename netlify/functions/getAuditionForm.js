'use strict'

const { sheetsClient, getRows, getCorsHeaders, ok, err, REGISTRY_SHEET_ID } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }

  const { productionCode } = event.queryStringParameters || {}
  if (!productionCode) return err('productionCode required', 400, origin)

  try {
    const sheets = await sheetsClient()
    const regRows = await getRows(sheets, REGISTRY_SHEET_ID, 'Registry!A:F')
    if (regRows.length < 2) return err('Production not found', 404, origin)
    const [rh, ...rd] = regRows
    const codeIdx = rh.indexOf('productionCode')
    const sheetIdx = rh.indexOf('sheetId')
    const row = rd.find(r => r[codeIdx] === productionCode.toUpperCase())
    if (!row) return err('Production not found', 404, origin)
    const sheetId = row[sheetIdx]

    const configRows = await getRows(sheets, sheetId, 'Config!A:B')
    const config = {}
    configRows.forEach(([k, v]) => { try { config[k] = JSON.parse(v) } catch { config[k] = v || '' } })

    if (config.useAuditions !== true && config.useAuditions !== 'true') {
      return err('Auditions not enabled for this production', 404, origin)
    }

    return ok({
      sheetId,
      productionTitle: config.title || '',
      directorName: config.directorName || '',
      directorEmail: config.directorEmail || '',
      headshotFolderId: config.headshotFolderId || '',
      auditionQuestions: config.auditionQuestions || []
    }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed: ' + e.message, 500, origin)
  }
}
