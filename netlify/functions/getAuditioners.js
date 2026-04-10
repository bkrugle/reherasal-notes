'use strict'

const { sheetsClient, getRows, CORS, ok, err } = require('./_sheets')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const { sheetId } = event.queryStringParameters || {}
  if (!sheetId) return err('sheetId required')

  try {
    const sheets = await sheetsClient()
    const [audRows, noteRows] = await Promise.all([
      getRows(sheets, sheetId, 'Auditioners!A:P').catch(() => []),
      getRows(sheets, sheetId, 'AuditionNotes!A:F').catch(() => [])
    ])

    if (audRows.length < 2) return ok({ auditioners: [] })

    const [header, ...data] = audRows
    const idx = {}
    header.forEach((col, i) => { idx[col] = i })

    // Build notes map
    const notesMap = {}
    if (noteRows.length > 1) {
      const [nh, ...nd] = noteRows
      const nidx = {}; nh.forEach((c, i) => { nidx[c] = i })
      nd.filter(r => r[nidx.deleted] !== 'true' && r.some(Boolean)).forEach(r => {
        const aid = r[nidx.auditionerId] || ''
        if (!notesMap[aid]) notesMap[aid] = []
        notesMap[aid].push({
          id: r[nidx.id] || '',
          text: r[nidx.text] || '',
          createdBy: r[nidx.createdBy] || '',
          createdAt: r[nidx.createdAt] || ''
        })
      })
    }

    const auditioners = data
      .filter(r => r[idx.deleted] !== 'true' && r.some(Boolean))
      .map(r => ({
        id: r[idx.id] || '',
        submittedAt: r[idx.submittedAt] || '',
        firstName: r[idx.firstName] || '',
        lastName: r[idx.lastName] || '',
        email: r[idx.email] || '',
        phone: r[idx.phone] || '',
        grade: r[idx.grade] || '',
        age: r[idx.age] || '',
        experience: r[idx.experience] || '',
        conflicts: r[idx.conflicts] || '',
        headshotUrl: r[idx.headshotUrl] || '',
        customAnswers: (() => { try { return JSON.parse(r[idx.customAnswers] || '{}') } catch { return {} } })(),
        role: r[idx.role] || '',
        castConfirmed: r[idx.castConfirmed] === 'true',
        notes: notesMap[r[idx.id]] || []
      }))

    return ok({ auditioners })
  } catch (e) {
    console.error(e)
    return err('Failed to load auditioners: ' + e.message, 500)
  }
}
