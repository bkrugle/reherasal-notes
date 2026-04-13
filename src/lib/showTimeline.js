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
    phase: 'preshow',
    act1Start: null,
    act1End: null,        // set when intermission starts
    intermissionStart: null,
    intermissionEnd: null, // set when act 2 starts
    act2Start: null,
    act2End: null,         // set when show ends
    perfNum: 1,
  }
}

// fmtElapsed(startIso, endIso?)
// If endIso provided, shows frozen elapsed. Otherwise live.
export function fmtElapsed(startIso, endIso = null) {
  if (!startIso) return '0:00'
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const totalSec = Math.floor(Math.abs(end - new Date(startIso).getTime()) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// elapsedMs(startIso, endIso?)
export function elapsedMs(startIso, endIso = null) {
  if (!startIso) return 0
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  return end - new Date(startIso).getTime()
}
