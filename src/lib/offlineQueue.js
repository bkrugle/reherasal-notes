// Offline Queue — IndexedDB-backed write queue
// When API POST calls fail due to no connectivity, they're stored here.
// On reconnect, they flush automatically in order.

const DB_NAME = 'ovature_offline'
const DB_VERSION = 1
const STORE = 'queue'

let db = null

function openDB() {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const d = e.target.result
      if (!d.objectStoreNames.contains(STORE)) {
        const store = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = e => { db = e.target.result; resolve(db) }
    req.onerror = () => reject(req.error)
  })
}

export async function enqueue(endpoint, method, payload, label = '') {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({
      endpoint,
      method,
      payload,
      label,
      createdAt: Date.now(),
      attempts: 0,
    })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueue() {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).index('createdAt').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function removeFromQueue(id) {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueueCount() {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Flush the queue — call this when connectivity is restored
// Returns { flushed, failed }
export async function flushQueue(onProgress) {
  const items = await getQueue()
  if (items.length === 0) return { flushed: 0, failed: 0 }

  let flushed = 0, failed = 0
  for (const item of items) {
    try {
      const res = await fetch(item.endpoint, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.method !== 'GET' ? JSON.stringify(item.payload) : undefined,
      })
      if (res.ok) {
        await removeFromQueue(item.id)
        flushed++
        onProgress?.({ flushed, failed, total: items.length, label: item.label })
      } else {
        failed++
      }
    } catch {
      failed++
      // Leave in queue to retry next time
    }
  }
  return { flushed, failed }
}
