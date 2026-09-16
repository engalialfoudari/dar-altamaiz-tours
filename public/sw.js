const CACHE = 'dt-tours-pwa-v1';
// Built from the SW's own registration scope, not domain root — this file
// can be registered under a mount prefix (e.g. /app/, /mobile/), and a
// root-absolute precache list would silently cache a DIFFERENT artifact's
// pages/icons if one happens to live at that other prefix.
const SCOPE = self.registration.scope;
const PRECACHE = [SCOPE, SCOPE + 'manifest.json', SCOPE + 'icons/icon-192.png', SCOPE + 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      });
      return cached || network;
    })
  );
});
