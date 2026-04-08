// WineAV Service Worker
const CACHE_NAME = 'wineav-v10';

// Assets to cache on install (app shell)
const SHELL_ASSETS = [
  '/index.html',
  '/dashboard.html',
  '/room.html',
  '/add-wine.html',
  '/edit-wine.html',
  '/profile.html',
  '/admin.html',
  '/forgot-password.html',
  '/reset-password.html',
  '/css/style.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/room.js',
  '/js/add-wine.js',
  '/js/edit-wine.js',
  '/js/profile.js',
  '/js/admin.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API calls, and non-http(s) schemes (ex: chrome-extension://)
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || !url.protocol.startsWith('http')) {
    return;
  }

  // For HTML pages: network first, fallback to cache
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For everything else: cache first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return res;
      });
    })
  );
});
