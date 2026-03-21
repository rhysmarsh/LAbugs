const CACHE_NAME = 'la-invertebrate-guide-v2.2';
const PHOTO_CACHE = 'la-invertebrate-photos-v1';
const INAT_CACHE = 'la-invertebrate-inat-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME, PHOTO_CACHE, INAT_CACHE];
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.hostname === 'api.inaturalist.org') {
    event.respondWith(
      caches.open(INAT_CACHE).then(async (cache) => {
        try {
          const networkResp = await fetch(event.request);
          if (networkResp.ok) cache.put(event.request, networkResp.clone());
          return networkResp;
        } catch {
          const cached = await cache.match(event.request);
          return cached || new Response('{"results":[]}', { headers: { 'Content-Type': 'application/json' } });
        }
      })
    );
    return;
  }

  if (url.hostname.includes('inaturalist') || url.hostname.includes('staticflickr') || url.hostname.includes('static.inaturalist.org')) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch { return new Response('', { status: 503 }); }
      })
    );
    return;
  }

  if (url.hostname.includes('arcgisonline') || url.hostname.includes('esri')) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch { return new Response('', { status: 503 }); }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp.ok && event.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});
