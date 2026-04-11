import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

const OLD_NOTES = [{"id":1775841558898,"scene":"","category":"general","priority":"med","cast":"","cue":"","text":"this sucks","time":"01:19 PM","date":"2026-04-10","swTime":"","resolved":false},{"id":1775780371038,"scene":"Full run","category":"general","priority":"med","cast":"","cue":"","text":"Panch remember to take mic after you hand Barfee the savings bond envelope","time":"08:19 PM","date":"2026-04-09","swTime":"@ 39:33","resolved":true},{"id":1775779313397,"scene":"Full run","category":"general","priority":"med","cast":"","cue":"","text":"Josiah - leave stage on 'or a mother'. beat, get up as Rona is walking on","time":"08:01 PM","date":"2026-04-09","swTime":"@ 21:55","resolved":true},{"id":1775779083238,"scene":"Full run","category":"general","priority":"med","cast":"","cue":"","text":"SOUND - pg 57 - offstage mic","time":"07:58 PM","date":"2026-04-09","swTime":"@ 18:05","resolved":false},{"id":1775778966055,"scene":"Full run","category":"general","priority":"med","cast":"","cue":"","text":"She knows six languages....YOU ALL SOUND BORED","time":"07:56 PM","date":"2026-04-09","swTime":"@ 16:08","resolved":true},{"id":1775776425603,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"","cue":"","text":"DANCE - Magic Foot - Let's have Kam come out with the rest of the DC - still looks too odd to me","time":"07:13 PM","date":"2026-04-09","swTime":"@ 25:31","resolved":true},{"id":1775776128971,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"","cue":"","text":"SOUND pg 31 - when Olive first come to the mic - have the level down (she isnt supposed to sound like shes speaking clearly into the mic)","time":"07:08 PM","date":"2026-04-09","swTime":"@ 20:35","resolved":false},{"id":1775775950205,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"","cue":"","text":"Leaf - bother the whole first row during NOT THAT SMART - not just Barfee","time":"07:05 PM","date":"2026-04-09","swTime":"@ 17:36","resolved":true},{"id":1775775868363,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"","cue":"","text":"Dan/Carl, fight over top of Logianne","time":"07:04 PM","date":"2026-04-09","swTime":"@ 16:14","resolved":true},{"id":1775775660860,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"","cue":"","text":"Pandemonium - Leaf do not stand up until Panch calls you up to spell","time":"07:01 PM","date":"2026-04-09","swTime":"@ 12:47","resolved":true},{"id":1775775251440,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"SOUND","cue":"","text":"Dictionary which I read on the toilet - faint sound of toilet flushing?","time":"06:54 PM","date":"2026-04-09","swTime":"@ 5:57","resolved":false},{"id":1775775157486,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"Orchestra","cue":"","text":"Roadkill - can we get a rimshot when she does her immitation? Maybe? Possibly?","time":"06:52 PM","date":"2026-04-09","swTime":"@ 4:23","resolved":false},{"id":1775775032888,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"Leaf Coneybear","cue":"","text":"LEAF - PHONE - Leaf don't turn from Mitch until MOM says LEAF - PHONE","time":"06:50 PM","date":"2026-04-09","swTime":"@ 2:19","resolved":true},{"id":1775774953482,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"","cue":"","text":"ASK JADYN FIRST - should rona blow her nose with her tissue after the RULES dance?","time":"06:49 PM","date":"2026-04-09","swTime":"@ 0:59","resolved":false},{"id":1775774737146,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"Logainne Schwartzandgrubenierre","cue":"","text":"Hvae you ever been to an auditorium before - change to have you ever been on stage before","time":"06:45 PM","date":"2026-04-09","swTime":"","resolved":true},{"id":1775774551579,"scene":"Act 1, Scene 1","category":"general","priority":"med","cast":"leaf","cue":"","text":"Leaf - at the 25th annual, we memorized the manual - say that to the bee puppet and talk with him until the dance starts","time":"06:42 PM","date":"2026-04-09","swTime":"","resolved":true}]

export default function ImportPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState([])

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, marginBottom: '1rem' }}>Please sign into your Spelling Bee production first.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Go to sign in</button>
        </div>
      </div>
    )
  }

  async function runImport() {
    setStatus('running')
    setProgress(0)
    setErrors([])

    const errs = []
    for (let i = 0; i < OLD_NOTES.length; i++) {
      const old = OLD_NOTES[i]
      const note = {
        date: old.date,
        scene: old.scene || '',
        category: old.category || 'general',
        priority: old.priority || 'med',
        cast: old.cast || '',
        cue: old.cue || '',
        swTime: old.swTime || '',
        text: old.text,
        resolved: old.resolved || false,
        carriedOver: false,
        attachmentUrl: '',
        pinned: false,
        privateNote: false,
        createdBy: 'Imported'
      }
      try {
        await api.saveNote(session.sheetId, note)
        setProgress(i + 1)
      } catch (e) {
        errs.push(`Note ${i + 1}: ${e.message}`)
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300))
    }

    setErrors(errs)
    setStatus('done')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: 500, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 48, marginBottom: '0.75rem' }}>📋</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Import Spelling Bee Notes</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>
            Importing 16 notes from your original app into <strong>{session.title}</strong>
          </p>
        </div>

        <div className="card">
          {status === 'idle' && (
            <>
              <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.6 }}>
                This will import all 16 notes from your original Spelling Bee rehearsal notes app.
                Notes will be added to your current production — signed in as <strong>{session.title}</strong> ({session.productionCode}).
              </p>
              <p style={{ fontSize: 13, color: 'var(--amber-text)', background: 'var(--amber-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                ⚠️ Make sure you're signed into the correct Spelling Bee production before importing.
              </p>
              <button className="btn btn-primary btn-full" onClick={runImport}>
                Import 16 notes →
              </button>
            </>
          )}

          {status === 'running' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>
                Importing… {progress} / {OLD_NOTES.length}
              </p>
              <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(progress / OLD_NOTES.length) * 100}%`,
                  background: 'var(--text)',
                  borderRadius: 4,
                  transition: 'width 0.3s'
                }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Please don't close this tab…</p>
            </div>
          )}

          {status === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, marginBottom: 8 }}>✓</p>
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>
                {OLD_NOTES.length - errors.length} of {OLD_NOTES.length} notes imported!
              </p>
              {errors.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--red-text)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '1rem', textAlign: 'left' }}>
                  {errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
              <button className="btn btn-primary btn-full" onClick={() => navigate('/production')}>
                Go to production →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
