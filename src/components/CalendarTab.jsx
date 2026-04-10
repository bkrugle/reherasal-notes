import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { detectScenesFromEvent, getEventSummary, eventToDate } from '../lib/sceneDetect'

function EventForm({ event, calendarId, onSaved, onCancel }) {
  const toLocalDatetime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [form, setForm] = useState({
    title: event?.title || 'Rehearsal',
    description: event?.description || '',
    location: event?.location || '',
    start: toLocalDatetime(event?.start) || '',
    end: toLocalDatetime(event?.end) || '',
    allDay: event?.allDay || false,
    attendees: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function save() {
    if (!form.title || !form.start) { setError('Title and start time required'); return }
    setSaving(true)
    setError('')
    try {
      const attendees = form.attendees ? form.attendees.split(',').map(e => e.trim()).filter(Boolean) : []
      const result = await api.upsertEvent({
        calendarId,
        eventId: event?.id || null,
        title: form.title,
        description: form.description,
        location: form.location,
        start: form.allDay ? form.start.slice(0, 10) : new Date(form.start).toISOString(),
        end: form.end ? (form.allDay ? form.end.slice(0, 10) : new Date(form.end).toISOString()) : null,
        allDay: form.allDay,
        attendees
      })
      onSaved(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ border: '0.5px solid var(--border2)', marginBottom: '1rem' }}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>{event ? 'Edit rehearsal' : 'New rehearsal'}</p>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Title</label>
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <input type="checkbox" id="allday" checked={form.allDay} onChange={e => set('allDay', e.target.checked)} style={{ width: 16, height: 16 }} />
        <label htmlFor="allday" style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 0, cursor: 'pointer' }}>All day</label>
      </div>

      <div className="grid2" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Start</label>
          <input type={form.allDay ? 'date' : 'datetime-local'} value={form.allDay ? form.start.slice(0,10) : form.start} onChange={e => set('start', e.target.value)} />
        </div>
        <div className="field">
          <label>End</label>
          <input type={form.allDay ? 'date' : 'datetime-local'} value={form.allDay ? form.end.slice(0,10) : form.end} onChange={e => set('end', e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Location</label>
        <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Valley High Auditorium" />
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Description</label>
        <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Act 1 run-through, focus on scene 3…" />
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Invite attendees (optional, comma-separated emails)</label>
        <input type="text" value={form.attendees} onChange={e => set('attendees', e.target.value)} placeholder="cast@school.edu, music.director@school.edu" />
      </div>

      {error && <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : event ? 'Save changes' : 'Create rehearsal'}</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default function CalendarTab({ calendarId, scenes, notes, onLogForDate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (calendarId) loadEvents()
  }, [calendarId])

  async function loadEvents() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getCalendar(calendarId, 3)
      setEvents(data.events || [])
    } catch (e) {
      setError('Failed to load calendar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteEvent(eventId) {
    if (!confirm('Remove this rehearsal from the calendar?')) return
    try {
      await api.deleteEvent(calendarId, eventId)
      setEvents(prev => prev.filter(e => e.id !== eventId))
    } catch (e) {
      alert('Failed to delete: ' + e.message)
    }
  }

  function onSaved(result) {
    setCreating(false)
    setEditingEvent(null)
    loadEvents()
  }

  if (!calendarId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text2)' }}>
        <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No calendar linked</p>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: '1.5rem' }}>
          Go to Setup → Details and paste your Google Calendar ID to link a rehearsal calendar.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>
          Find your Calendar ID in Google Calendar → Settings → your calendar → "Calendar ID"
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p style={{ fontSize: 13, color: 'var(--text2)' }}>Next 3 weeks</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={loadEvents}>↻ Refresh</button>
          <button className="btn btn-sm btn-primary" onClick={() => { setCreating(true); setEditingEvent(null) }}>+ New rehearsal</button>
        </div>
      </div>

      {creating && (
        <EventForm calendarId={calendarId} onSaved={onSaved} onCancel={() => setCreating(false)} />
      )}

      {error && <p style={{ fontSize: 13, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>{error}</p>}

      {loading ? (
        <div className="empty">Loading rehearsals…</div>
      ) : events.length === 0 ? (
        <div className="empty">No rehearsals in the next 3 weeks.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(event => {
            const dt = new Date(event.start)
            const dateLabel = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
            const timeLabel = event.allDay ? 'All day' : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const eventDate = eventToDate(event)
            const notesForEvent = notes.filter(n => n.date === eventDate)
            const openNotes = notesForEvent.filter(n => !n.resolved)

            // Smart scene detection
            const { suggestedScene, confidence } = detectScenesFromEvent(event.title, event.description, scenes)

            const isExpanded = expandedId === event.id
            const isEditing = editingEvent?.id === event.id

            const isToday = eventDate === new Date().toISOString().slice(0, 10)
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
            const isTomorrow = eventDate === tomorrow.toISOString().slice(0, 10)

            return (
              <div key={event.id} className="card" style={{ borderLeft: isToday ? '3px solid var(--blue-text)' : isTomorrow ? '3px solid var(--amber-text)' : '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                {isEditing ? (
                  <EventForm event={event} calendarId={calendarId} onSaved={onSaved} onCancel={() => setEditingEvent(null)} />
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{event.title}</span>
                          {isToday && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--blue-bg)', color: 'var(--blue-text)' }}>Today</span>}
                          {isTomorrow && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-bg)', color: 'var(--amber-text)' }}>Tomorrow</span>}
                          {openNotes.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--coral-bg)', color: 'var(--coral-text)' }}>
                              {openNotes.length} open note{openNotes.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
                          <span>{dateLabel} · {timeLabel}</span>
                          {event.location && <span style={{ color: 'var(--text3)' }}>@ {event.location}</span>}
                        </div>

                        {/* Smart scene detection hint */}
                        {suggestedScene && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Detected scene:</span>
                            <span style={{
                              fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                              background: confidence === 'high' ? 'var(--green-bg)' : confidence === 'medium' ? 'var(--blue-bg)' : 'var(--gray-bg)',
                              color: confidence === 'high' ? 'var(--green-text)' : confidence === 'medium' ? 'var(--blue-text)' : 'var(--gray-text)'
                            }}>{suggestedScene}</span>
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{confidence} confidence</span>
                          </div>
                        )}

                        {event.description && (
                          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>{event.description}</p>
                        )}
                      </div>

                      <button className="btn btn-sm" onClick={() => setExpandedId(isExpanded ? null : event.id)}
                        style={{ flexShrink: 0 }}>{isExpanded ? '↑' : '↓'}</button>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '0.5px solid var(--border)' }}>
                        {/* Notes for this date */}
                        {notesForEvent.length > 0 && (
                          <div style={{ marginBottom: '1rem' }}>
                            <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 6 }}>
                              Notes from this rehearsal ({notesForEvent.length})
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {notesForEvent.slice(0, 5).map(n => (
                                <div key={n.id} style={{ display: 'flex', gap: 6, fontSize: 13, padding: '4px 0', borderBottom: '0.5px solid var(--border)', opacity: n.resolved ? 0.5 : 1 }}>
                                  <span className={`pdot pdot-${n.priority}`} style={{ marginTop: 4, flexShrink: 0 }} />
                                  <span style={{ color: 'var(--text)' }}>{n.text}</span>
                                  {n.resolved && <span style={{ fontSize: 11, color: 'var(--green-text)', marginLeft: 'auto', flexShrink: 0 }}>✓</span>}
                                </div>
                              ))}
                              {notesForEvent.length > 5 && (
                                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>+{notesForEvent.length - 5} more — see Review tab</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-primary"
                            onClick={() => onLogForDate(eventDate, suggestedScene)}>
                            Log notes for this rehearsal
                          </button>
                          <button className="btn btn-sm" onClick={() => setEditingEvent(event)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteEvent(event.id)}>Delete</button>
                          {event.htmlLink && (
                            <a href={event.htmlLink} target="_blank" rel="noreferrer"
                              className="btn btn-sm" style={{ textDecoration: 'none' }}>
                              Open in Google Calendar ↗
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
