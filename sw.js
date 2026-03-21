const CACHE_NAME = 'la-invertebrate-guide-v2.4';
const PHOTO_CACHE = 'la-invertebrate-photos-v1';
const INAT_CACHE = 'la-invertebrate-inat-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json',
  'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME, PHOTO_CACHE, INAT_CACHE];
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.hostname === 'api.inaturalist.org') {
    event.respondWith(caches.open(INAT_CACHE).then(async (cache) => {
      try { const nr = await fetch(event.request); if (nr.ok) cache.put(event.request, nr.clone()); return nr; }
      catch { const c = await cache.match(event.request); return c || new Response('{"results":[]}', { headers: { 'Content-Type': 'application/json' } }); }
    })); return;
  }
  if (url.hostname.includes('inaturalist') || url.hostname.includes('staticflickr') || url.hostname.includes('static.inaturalist.org')) {
    event.respondWith(caches.open(PHOTO_CACHE).then(async (cache) => {
      const c = await cache.match(event.request); if (c) return c;
      try { const r = await fetch(event.request); if (r.ok) cache.put(event.request, r.clone()); return r; }
      catch { return new Response('', { status: 503 }); }
    })); return;
  }
  if (url.hostname.includes('arcgisonline') || url.hostname.includes('esri')) {
    event.respondWith(caches.open(PHOTO_CACHE).then(async (cache) => {
      const c = await cache.match(event.request); if (c) return c;
      try { const r = await fetch(event.request); if (r.ok) cache.put(event.request, r.clone()); return r; }
      catch { return new Response('', { status: 503 }); }
    })); return;
  }
  event.respondWith(caches.match(event.request).then((c) => {
    if (c) return c;
    return fetch(event.request).then((r) => {
      if (r.ok && event.request.method === 'GET') { const cl = r.clone(); caches.open(CACHE_NAME).then((ca) => ca.put(event.request, cl)); }
      return r;
    });
  }));
});
