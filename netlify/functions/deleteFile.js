'use strict'

const { driveClient, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { fileId } = body
  if (!fileId) return err('fileId required')

  try {
    const drive = await driveClient()
    await drive.files.delete({ fileId, supportsAllDrives: true })
    return ok({ deleted: true })
  } catch (e) {
    console.error(e)
    return err('Failed to delete file: ' + e.message, 500)
  }
}
