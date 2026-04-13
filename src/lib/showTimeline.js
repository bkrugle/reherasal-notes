// Shared show timeline state — persisted in localStorage
// Used by ShowDayTab and IntermissionDashboard

const KEY = (sheetId, showDate) => `rn_timeline_${sheetId}_${showDate}`

export function getTimeline(sheetId, showDate) {
  try {
    return JSON.parse(localStorage.getItem(KEY(sheetId, showDate)) || 'null') || defaultTimeline()
  } catch { return defaultTimeline() }
}

export function saveTimeline(sheetId, showDate, state) {
  localStorage.setItem(KEY(sheetId, showDate), JSON.stringify(state))
}

export function defaultTimeline() {
  return {
    phase: 'preshow',   // preshow | act1 | intermission | act2 | done
    act1Start: null,
    intermissionStart: null,
    act2Start: null,
    showEnd: null,
    perfNum: 1,
  }
}

export function fmtElapsed(startIso) {
  if (!startIso) return '0:00'
  const ms = Date.now() - new Date(startIso).getTime()
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function elapsedMs(startIso) {
  if (!startIso) return 0
  return Date.now() - new Date(startIso).getTime()
}
