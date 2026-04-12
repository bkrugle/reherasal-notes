import { useState, useEffect, useCallback } from 'react'
import { getQueueCount, flushQueue } from '../lib/offlineQueue'

export default function OfflineManager() {
  const [online, setOnline]       = useState(navigator.onLine)
  const [queueCount, setQueueCount] = useState(0)
  const [syncing, setSyncing]     = useState(false)
  const [lastSync, setLastSync]   = useState(null)
  const [syncResult, setSyncResult] = useState(null) // { flushed, failed }

  const refreshCount = useCallback(async () => {
    try { setQueueCount(await getQueueCount()) } catch {}
  }, [])

  // Poll queue count every 5s so badge stays current
  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 5000)
    return () => clearInterval(t)
  }, [refreshCount])

  // Listen for online/offline events
  useEffect(() => {
    const goOnline  = () => { setOnline(true);  attemptSync() }
    const goOffline = () => { setOnline(false); setSyncResult(null) }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  async function attemptSync() {
    const count = await getQueueCount()
    if (count === 0) return
    setSyncing(true)
    try {
      const result = await flushQueue(({ flushed, total }) => {
        // Could show per-item progress here if desired
      })
      setSyncResult(result)
      setLastSync(new Date())
      await refreshCount()
    } catch {}
    finally { setSyncing(false) }
  }

  // Nothing to show if online and queue is empty
  if (online && queueCount === 0 && !syncResult) return null

  // Syncing in progress
  if (syncing) {
    return (
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: '#1d4ed8', color: '#fff',
        padding: '8px 18px', borderRadius: 24,
        fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 9999,
      }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        Syncing {queueCount} queued item{queueCount !== 1 ? 's' : ''}…
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Sync result flash
  if (online && syncResult) {
    return (
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: syncResult.failed > 0 ? '#b45309' : '#15803d', color: '#fff',
        padding: '8px 18px', borderRadius: 24,
        fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 9999, cursor: 'pointer',
      }} onClick={() => setSyncResult(null)}>
        {syncResult.failed > 0
          ? `⚠ Synced ${syncResult.flushed}, ${syncResult.failed} failed — tap to dismiss`
          : `✓ ${syncResult.flushed} item${syncResult.flushed !== 1 ? 's' : ''} synced — tap to dismiss`
        }
      </div>
    )
  }

  // Online with pending queue
  if (online && queueCount > 0) {
    return (
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: '#1d4ed8', color: '#fff',
        padding: '8px 18px', borderRadius: 24,
        fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 9999, cursor: 'pointer',
      }} onClick={attemptSync}>
        ↑ {queueCount} item{queueCount !== 1 ? 's' : ''} queued — tap to sync now
      </div>
    )
  }

  // Offline banner
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#1a1a1a', color: '#fff',
      padding: '10px 20px',
      fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      zIndex: 9999, borderTop: '2px solid #ef4444',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>📵</span>
        <div>
          <div style={{ fontWeight: 700 }}>You're offline</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
            {queueCount > 0
              ? `${queueCount} action${queueCount !== 1 ? 's' : ''} queued — will sync when reconnected`
              : 'Notes and check-ins will queue and sync when reconnected'
            }
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
        {queueCount > 0 && (
          <div style={{ background: '#ef4444', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
            {queueCount} pending
          </div>
        )}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          Mic tracker &amp; checklists work offline
        </div>
      </div>
    </div>
  )
}
