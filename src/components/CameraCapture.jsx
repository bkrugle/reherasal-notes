import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function CameraCapture({ stream, onSnap, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (!stream) return
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    video.play().catch(e => console.warn('play:', e))
    // Lock scroll on body while camera is open
    document.body.style.overflow = 'hidden'
    return () => {
      video.srcObject = null
      document.body.style.overflow = ''
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

  const overlay = (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100%', height: '100%',
      zIndex: 99999,
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      boxSizing: 'border-box',
      WebkitOverflowScrolling: 'touch'
    }}>
      <p style={{ color: '#fff', fontSize: 14, marginBottom: 12, opacity: 0.8 }}>
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
          height: 'auto',
          maxHeight: '65vh',
          borderRadius: 12,
          background: '#111',
          display: 'block',
          objectFit: 'cover'
        }}
      />

      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        <button
          onClick={snap}
          style={{
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: '50%',
            width: 72,
            height: 72,
            fontSize: 30,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >📸</button>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '50%',
            width: 72,
            height: 72,
            fontSize: 22,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >✕</button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 16, textAlign: 'center' }}>
        Tap 📸 to capture · ✕ to cancel
      </p>
    </div>
  )

  return createPortal(overlay, document.body)
}
