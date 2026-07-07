// ServiKargo Service Worker v6
// Estrategia simple: cachea solo recursos estáticos, NUNCA intercepta Firebase ni APIs

const CACHE = 'sk-v6';

// Solo recursos del app shell propio
const SHELL = [
  '/SERVIKARGO2/',
  '/SERVIKARGO2/index.html',
  '/SERVIKARGO2/manifest.json',
  '/SERVIKARGO2/icon-192.png',
  '/SERVIKARGO2/icon-512.png',
];

// INSTALL — cachear el shell básico
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
  );
});

// ACTIVATE — limpiar caches viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// FETCH — NUNCA interceptar Firebase ni servicios externos críticos
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // ── DEJAR PASAR SIN INTERCEPTAR (siempre red) ─────────────────────────────
  if (
    url.includes('firebaseio.com')        ||  // Firebase Realtime DB
    url.includes('firebasestorage')       ||  // Firebase Storage
    url.includes('firebase.googleapis')   ||  // Firebase Auth
    url.includes('identitytoolkit')       ||  // Firebase Auth
    url.includes('securetoken.google')    ||  // Firebase tokens
    url.includes('googleapis.com')        ||  // Google APIs
    url.includes('nominatim')             ||  // Mapas
    url.includes('openstreetmap')         ||  // Mapas tiles
    url.includes('wa.me')                 ||  // WhatsApp
    url.includes('maps.google')           ||  // Google Maps
    url.includes('gstatic.com')           ||  // Google static (fonts etc)
    url.includes('fonts.google')          ||  // Google Fonts
    e.request.method !== 'GET'               // POST, PUT, DELETE, etc.
  ) {
    return; // No interceptar — dejar ir directo a la red
  }

  // ── CDN de la app (React, Babel, etc.) — cache-first ─────────────────────
  if (
    url.includes('unpkg.com')             ||
    url.includes('cdnjs.cloudflare.com')  ||
    url.includes('jsdelivr.net')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request, { mode: 'no-cors' }).then(res => {
          if (res) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // ── App shell propio — network-first, fallback a cache ───────────────────
  if (url.includes('servikargo1.github.io')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request)
          .then(cached => cached || caches.match('/SERVIKARGO2/index.html'))
        )
    );
    return;
  }

  // Todo lo demás: red directa
});

// Mensajes desde la app
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

