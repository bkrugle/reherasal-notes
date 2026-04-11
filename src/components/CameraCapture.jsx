import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function CameraCapture({ stream, onSnap, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (!stream) return
    const video = videoRef.current
    if (!video) {
      // Video not mounted yet — retry after next paint
      const raf = requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(e => console.warn('play:', e))
        }
      })
      document.body.style.overflow = 'hidden'
      return () => { cancelAnimationFrame(raf); document.body.style.overflow = '' }
    }
    video.srcObject = stream
    video.play().catch(e => console.warn('play:', e))
    document.body.style.overflow = 'hidden'
    return () => {
      video.srcObject = null
      document.body.style.overflow = ''
    }
  }, [stream])

  function snap() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      console.warn('Video not ready to snap')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const preview = canvas.toDataURL('image/jpeg', 0.85)
    onSnap({ base64: preview.split(',')[1], preview })
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        background: '#000',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <p style={{ color: '#fff', fontSize: 16, marginBottom: 16 }}>
        Position your face in the frame
      </p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          maxHeight: '60vh',
          background: '#222',
          borderRadius: 8,
          display: 'block'
        }}
      />

      <div style={{ display: 'flex', gap: 20, marginTop: 24 }}>
        <button
          type="button"
          onClick={snap}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#fff', border: 'none',
            fontSize: 32, cursor: 'pointer'
          }}
        >📸</button>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.5)',
            color: '#fff', fontSize: 24, cursor: 'pointer'
          }}
        >✕</button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 16 }}>
        Tap 📸 to take photo · ✕ to cancel
      </p>
    </div>,
    document.body
  )
}
