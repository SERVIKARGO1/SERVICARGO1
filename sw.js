const CACHE_NAME = 'servikargo-v5';
const BASE = 'https://servikargo1.github.io/SERVIKARGO2/';

const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

const APP_SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'icon-192-maskable.png',
  BASE + 'icon-512-maskable.png',
];

// INSTALL — cachear app shell y CDN
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // App shell (must succeed)
      return cache.addAll(APP_SHELL).catch(() => {})
        .then(() =>
          // CDN (best effort, no-cors)
          Promise.allSettled(
            CDN_ASSETS.map(url =>
              fetch(url, { mode: 'no-cors', credentials: 'omit' })
                .then(r => cache.put(url, r))
                .catch(() => {})
            )
          )
        );
    })
  );
});

// ACTIVATE — limpiar caches viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// FETCH — estrategia por tipo de recurso
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase y APIs en tiempo real: siempre red
  if (url.includes('firebaseio.com') ||
      url.includes('firebasestorage') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('nominatim.openstreetmap') ||
      url.includes('tile.openstreetmap') ||
      url.includes('wa.me') ||
      url.includes('maps.google')) {
    return; // fetch normal sin interceptar
  }

  // CDN (React, Firebase SDK, etc.): cache-first
  if (url.includes('unpkg.com') ||
      url.includes('gstatic.com') ||
      url.includes('cdnjs.cloudflare.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request, { mode: 'no-cors' })
          .then(r => {
            const clone = r.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            return r;
          })
        )
    );
    return;
  }

  // App shell: network-first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)
        .then(cached => cached || caches.match(BASE + 'index.html'))
      )
  );
});

// Mensaje desde la app para limpiar cache
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0]?.postMessage({ cleared: true });
    });
  }
});
