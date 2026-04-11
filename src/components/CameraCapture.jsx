import { useEffect, useRef } from 'react'

// Fully self-contained camera overlay
// Mounts a video element directly to document.body to avoid React re-render issues
export default function CameraCapture({ stream, onSnap, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (!stream) return
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    video.play().catch(e => console.warn('play:', e))
    return () => {
      video.srcObject = null
    }
  }, [stream])

  function snap() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const preview = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = preview.split(',')[1]
    onSnap({ base64, preview })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <p style={{ color: '#fff', fontSize: 14, marginBottom: '1rem', opacity: 0.7 }}>
        Position your face in the frame
      </p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '60vh',
          borderRadius: 12,
          background: '#111',
          display: 'block'
        }}
      />
      <div style={{ display: 'flex', gap: 12, marginTop: '1.5rem' }}>
        <button
          onClick={snap}
          style={{
            background: '#fff', color: '#000',
            border: 'none', borderRadius: 50,
            width: 64, height: 64, fontSize: 28,
            cursor: 'pointer', fontWeight: 700
          }}
        >📸</button>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 50, width: 64, height: 64,
            fontSize: 20, cursor: 'pointer'
          }}
        >✕</button>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: '1rem' }}>
        Tap 📸 to capture · ✕ to cancel
      </p>
    </div>
  )
}
