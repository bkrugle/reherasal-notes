const BASE = '/api'

async function call(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  createProduction: (payload) => call('/createProduction', 'POST', payload),
  authenticate: (productionCode, pin) => call('/authenticate', 'POST', { productionCode, pin }),
  getProduction: (sheetId) => call(`/getProduction?sheetId=${sheetId}`),
  updateProduction: (payload) => call('/updateProduction', 'POST', payload),
  getNotes: (sheetId) => call(`/getNotes?sheetId=${sheetId}`),
  saveNote: (sheetId, note) => call('/saveNote', 'POST', { sheetId, note }),
  updateNote: (sheetId, id, changes) => call('/updateNote', 'POST', { sheetId, id, changes }),
  sendReport: (payload) => call('/sendReport', 'POST', payload),
  sendCastNotes: (payload) => call('/sendCastNotes', 'POST', payload),
  getCalendar: (calendarId, weeks = 3) => call(`/getCalendar?calendarId=${encodeURIComponent(calendarId)}&weeks=${weeks}`),
  upsertEvent: (payload) => call('/upsertEvent', 'POST', payload),
  deleteEvent: (calendarId, eventId) => call('/deleteEvent', 'POST', { calendarId, eventId }),
  uploadFile: (payload) => call('/uploadFile', 'POST', payload),
  getFiles: (folderId) => call(`/getFiles?folderId=${encodeURIComponent(folderId)}`),
  deleteFile: (fileId) => call('/deleteFile', 'POST', { fileId }),
  deleteProduction: (sheetId, productionCode) => call('/deleteProduction', 'POST', { sheetId, productionCode }),
}
