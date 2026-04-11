import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function CameraCapture({ stream, onSnap, onClose }) {
  const videoRef = useRef(null)

  // Use a callback ref so we attach stream the instant the element exists
  const setVideoRef = (node) => {
    videoRef.current = node
    if (node && stream) {
      node.srcObject = stream
      node.play().catch(() => {})
    }
  }

  // Also try via useEffect as backup
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (video && stream) {
      video.srcObject = stream
      video.play().catch(() => {})
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
    onSnap({ base64: preview.split(',')[1], preview })
  }

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100%', height: '100%',
      background: '#000',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 20,
      boxSizing: 'border-box'
    }}>
      <p style={{ color: '#fff', fontSize: 15, margin: 0 }}>Position your face in the frame</p>

      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '60vh',
          objectFit: 'cover',
          borderRadius: 8,
          background: '#333'
        }}
      />

      <div style={{ display: 'flex', gap: 20 }}>
        <button type="button" onClick={snap}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#fff', border: 'none',
            fontSize: 28, cursor: 'pointer'
          }}>📸</button>
        <button type="button" onClick={onClose}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.5)',
            color: '#fff', fontSize: 22, cursor: 'pointer'
          }}>✕</button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0 }}>
        Tap 📸 to capture · ✕ to cancel
      </p>
    </div>,
    document.body
  )
}
