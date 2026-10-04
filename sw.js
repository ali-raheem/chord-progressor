// Bump this version whenever a cached file changes. Updates activate after
// existing app windows close, keeping each session on one consistent version.
const CACHE_VERSION = 'v1';
// Caches are shared by every app on the origin. The prefix is unique to this app and
// its scope, and only caches carrying it are ever opened or deleted.
const CACHE_PREFIX = `chordprogressor-app-${encodeURIComponent(self.registration.scope)}-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_FILES = [
  './', './index.html', './styles.css', './app.js', './progressions.js', './pwa.js', './version.js',
  './favicon.svg', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
].map(file => new URL(file, self.registration.scope).pathname);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Versioned requests also bypass stale assets retained by a CDN.
    await cache.addAll(APP_FILES.map(url => new Request(`${url}?v=${CACHE_VERSION}`, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Only handle this app's files; other apps' paths on the origin pass straight through.
  if (!APP_FILES.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.pathname, { ignoreSearch: true });
    return cached || fetch(request);
  })());
});
