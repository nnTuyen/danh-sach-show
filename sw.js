/**
 * Dating show - minimal service worker.
 * Caches the same-origin app shell (HTML/CSS/JS/local images) for fast
 * repeat visits and basic offline. Deliberately does NOT cache:
 *  - showsData.json (must always be fresh; the app busts cache with ?v=Date.now())
 *  - cross-origin requests (fonts, flag/poster CDNs, favicons) to avoid
 *    opaque-response storage bloat.
 */
const CACHE_NAME = 'datinghub-shell-v1';
const CORE_SHELL = ['./', './index.html', './manifest.json', './images/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // CDN/fonts: passthrough
  if (url.pathname.endsWith('showsData.json')) return; // data: always network
  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then(
      hit => hit || fetch(request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return res;
      })
    )
  );
});
