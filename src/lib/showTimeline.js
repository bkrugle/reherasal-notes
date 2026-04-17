const KEY = (sheetId, showDate) => `rn_timeline_${sheetId}_${showDate}`

export function getTimeline(sheetId, showDate) {
  try {
    return JSON.parse(localStorage.getItem(KEY(sheetId, showDate)) || 'null') || defaultTimeline()
  } catch { return defaultTimeline() }
}

export function saveTimeline(sheetId, showDate, state) {
  localStorage.setItem(KEY(sheetId, showDate), JSON.stringify(state))
}

export async function saveTimelineRemote(sheetId, showDate, timeline) {
  try {
    await fetch('/.netlify/functions/saveTimeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId, showDate, timeline })
    })
    // Also save locally as cache
    saveTimeline(sheetId, showDate, timeline)
  } catch (e) {
    console.warn('Remote timeline save failed:', e.message)
    // Fall back to local only
    saveTimeline(sheetId, showDate, timeline)
  }
}

export async function getTimelineRemote(sheetId, showDate) {
  try {
    const res = await fetch(`/.netlify/functions/getTimeline?sheetId=${sheetId}&showDate=${showDate}`)
    const data = await res.json()
    if (data.timeline) {
      // Cache locally
      saveTimeline(sheetId, showDate, data.timeline)
      return { timeline: data.timeline, lockedBy: data.lockedBy || '' }
    }
  } catch (e) {
    console.warn('Remote timeline fetch failed:', e.message)
  }
  // Fall back to local
  return { timeline: getTimeline(sheetId, showDate), lockedBy: '' }
}

export function defaultTimeline() {
  return {
    phase: 'preshow',
    act1Start: null,
    act1End: null,
    intermissionStart: null,
    intermissionEnd: null,
    act2Start: null,
    act2End: null,
    perfNum: 1,
    lockedBy: null,
  }
}

// fmtElapsed(startIso, endIso?)
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
