'use strict'

const { driveClient, getCorsHeaders, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405, origin)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON', 400, origin) }

  const { fileId } = body
  if (!fileId) return err('fileId required', 400, origin)

  try {
    const drive = await driveClient()
    await drive.files.delete({ fileId, supportsAllDrives: true })
    return ok({ deleted: true }, origin)
  } catch (e) {
    console.error(e)
    return err('Failed to delete file: ' + e.message, 500, origin)
  }
}
