'use strict'

const { driveClient, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const { folderId } = event.queryStringParameters || {}
  if (!folderId) return err('folderId required')

  try {
    const drive = await driveClient()
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id,name,mimeType,size,createdTime,webViewLink,description,thumbnailLink)',
      orderBy: 'createdTime desc'
    })

    const files = (res.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      createdTime: f.createdTime,
      webViewLink: f.webViewLink,
      category: f.description || 'general',
      thumbnailLink: f.thumbnailLink || null
    }))

    return ok({ files })
  } catch (e) {
    console.error(e)
    return err('Failed to list files: ' + e.message, 500)
  }
}
