'use strict'

const { driveClient, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body) } catch { return err('Invalid JSON') }

  const { folderId, fileName, mimeType, base64Data, category } = body
  if (!folderId || !fileName || !base64Data) return err('folderId, fileName, and base64Data required')

  try {
    const drive = await driveClient()
    const buffer = Buffer.from(base64Data, 'base64')

    // Use multipart upload
    const boundary = '-------314159265358979323846'
    const delimiter = '\r\n--' + boundary + '\r\n'
    const closeDelimiter = '\r\n--' + boundary + '--'

    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      description: category || 'general'
    })

    const multipartBody = Buffer.concat([
      Buffer.from(delimiter + 'Content-Type: application/json\r\n\r\n' + metadata + delimiter + 'Content-Type: ' + (mimeType || 'application/octet-stream') + '\r\nContent-Transfer-Encoding: base64\r\n\r\n'),
      Buffer.from(base64Data),
      Buffer.from(closeDelimiter)
    ])

    const { google } = require('googleapis')
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const creds = JSON.parse(json)
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive']
    })
    const authClient = await auth.getClient()
    const accessToken = await authClient.getAccessToken()

    // Use fetch for multipart upload
    const https = require('https')
    const uploadRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,size,mimeType',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken.token,
          'Content-Type': 'multipart/related; boundary="' + boundary + '"',
          'Content-Length': multipartBody.length
        }
      }, res => {
        let data = ''
        res.on('data', d => data += d)
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }))
      })
      req.on('error', reject)
      req.write(multipartBody)
      req.end()
    })

    if (uploadRes.status >= 400) {
      throw new Error(uploadRes.data.error?.message || 'Upload failed')
    }

    return ok({
      id: uploadRes.data.id,
      name: uploadRes.data.name,
      webViewLink: uploadRes.data.webViewLink,
      size: uploadRes.data.size,
      mimeType: uploadRes.data.mimeType,
      category: category || 'general'
    })
  } catch (e) {
    console.error(e)
    return err('Upload failed: ' + e.message, 500)
  }
}
