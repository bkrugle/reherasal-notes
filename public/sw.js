// Ovature Service Worker — v1
// Caches app shell for offline load, passes API calls through with network-first strategy

const CACHE_NAME = 'ovature-shell-v1'

// These are the built asset patterns we cache on install
// Vite hashes filenames, so we cache by pattern at runtime instead
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
]

// Routes that are always app shell (SPA client-side routes)
const APP_ROUTES = [
  '/production', '/setup', '/checkin', '/portal',
  '/audition', '/create', '/import',
]

// API calls — never cache, always network (with offline fallback)
const API_PREFIX = '/api/'
const NETLIFY_PREFIX = '/.netlify/functions/'

// ── INSTALL: cache the precache URLs ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ── ACTIVATE: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET for caching (POST etc handled by queue in app)
  // But still let them through to network
  if (request.method !== 'GET') return

  // API calls — network first, offline JSON fallback
  if (url.pathname.startsWith(API_PREFIX) || url.pathname.startsWith(NETLIFY_PREFIX)) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ offline: true, error: 'You are offline. This action will sync when reconnected.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )
    return
  }

  // HTML navigation (SPA routes) — serve cached shell, fall back to network
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then(cached => cached || fetch(request))
    )
    return
  }

  // Static assets (JS, CSS, fonts, images) — cache first, then network, then cache for next time
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        // Cache successful static asset responses
        if (response && response.status === 200 && response.type === 'basic') {
          const toCache = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, toCache))
        }
        return response
      }).catch(() => cached) // If both fail, return whatever we have
    })
  )
})

// ── MESSAGE: force update ─────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
