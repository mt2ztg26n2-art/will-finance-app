const CACHE_NAME = 'will-finance-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './assets/css/app.css',
  './assets/js/supabase-config.js',
  './assets/js/auth.js',
  './assets/js/sync.js',
  './assets/js/storage.js',
  './assets/js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
