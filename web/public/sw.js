const CACHE_NAME = 'kenty-shell-v2';
const APP_BASE = new URL('./', self.registration.scope).pathname;
const APP_SHELL = [APP_BASE, APP_BASE + 'manifest.webmanifest', APP_BASE + 'icons/kenty.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('kenty-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(APP_BASE + 'functions/') || url.pathname.startsWith(APP_BASE + 'api/')) return;
  if (url.pathname.startsWith(APP_BASE + 'src/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_BASE, copy));
        }
        return response;
      }).catch(() => caches.match(APP_BASE))
    );
    return;
  }

  if (url.pathname.startsWith(APP_BASE + 'assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
