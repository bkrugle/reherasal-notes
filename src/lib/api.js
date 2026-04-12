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
  // Auth
  createProduction: (payload) => call('/createProduction', 'POST', payload),
  authenticate: (productionCode, pin) => call('/authenticate', 'POST', { productionCode, pin }),
  authenticateWithNewPin: (productionCode, inviteCode, newPin) => call('/authenticate', 'POST', { productionCode, pin: inviteCode, newPin }),
  sendWelcome: (payload) => call('/sendWelcome', 'POST', payload),
  // Production
  getProduction: (sheetId) => call(`/getProduction?sheetId=${sheetId}`),
  updateProduction: (payload) => call('/updateProduction', 'POST', payload),
  deleteProduction: (sheetId, productionCode) => call('/deleteProduction', 'POST', { sheetId, productionCode }),
  // Notes
  getNotes: (sheetId) => call(`/getNotes?sheetId=${sheetId}`),
  saveNote: (sheetId, note) => call('/saveNote', 'POST', { sheetId, note }),
  updateNote: (sheetId, id, changes) => call('/updateNote', 'POST', { sheetId, id, changes }),
  // Email
  sendReport: (payload) => call('/sendReport', 'POST', payload),
  sendCastNotes: (payload) => call('/sendCastNotes', 'POST', payload),
  // Calendar
  getCalendar: (calendarId, weeks = 3) => call(`/getCalendar?calendarId=${encodeURIComponent(calendarId)}&weeks=${weeks}`),
  upsertEvent: (payload) => call('/upsertEvent', 'POST', payload),
  deleteEvent: (calendarId, eventId) => call('/deleteEvent', 'POST', { calendarId, eventId }),
  // Files
  uploadFile: (payload) => call('/uploadFile', 'POST', payload),
  getFiles: (folderId) => call(`/getFiles?folderId=${encodeURIComponent(folderId)}`),
  deleteFile: (fileId) => call('/deleteFile', 'POST', { fileId }),
  // Auditions
  getAuditionForm: (productionCode) => call(`/getAuditionForm?productionCode=${productionCode}`),
  submitAudition: (payload) => call('/submitAudition', 'POST', payload),
  getAuditioners: (sheetId) => call(`/getAuditioners?sheetId=${sheetId}`),
  saveAuditionNote: (payload) => call('/saveAuditionNote', 'POST', payload),
  getAuditionByToken: (productionCode, token) => call(`/getAuditionByToken?productionCode=${productionCode}&token=${token}`),
  assignRole: (payload) => call('/assignRole', 'POST', payload),
  generateAuditionMaterials: (showTitle, requestType) => call('/generateAuditionMaterials', 'POST', { showTitle, requestType }),
  generateCastDirectory: (sheetId, productionTitle, useAuditions) => call('/generateCastDirectory', 'POST', { sheetId, productionTitle, useAuditions }),
  recoverProductionCode: (email, appUrl) => call('/recoverProductionCode', 'POST', { email, appUrl }),
  lookupShowCast: (showTitle) => call('/lookupShowCast', 'POST', { showTitle }),
  lookupShowScenes: (showTitle) => call('/lookupShowScenes', 'POST', { showTitle }),
  showCheckin: (data) => call('/showCheckin', 'POST', data),
  getCheckinStatus: (sheetId, showDate) => call(`/getCheckinStatus?sheetId=${sheetId}&showDate=${showDate}`),
  getPublicCheckinStatus: (productionCode, showDate) => call(`/showCheckin?productionCode=${productionCode}&showDate=${showDate}`),
  sendCheckinAlerts: (data) => call('/sendCheckinAlerts', 'POST', data),
  sendTestNotification: (data) => call('/sendTestNotification', 'POST', data),
}
