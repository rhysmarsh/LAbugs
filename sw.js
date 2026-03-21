// ═══════════════════════════════════════════════════════════════
// LA County Pollinator Field Guide — Service Worker v2.0
// Cache-first for app shell, network-first for iNat API
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'la-pollinator-guide-v2.1';
const PHOTO_CACHE = 'la-pollinator-photos-v1';
const INAT_CACHE = 'la-pollinator-inat-v1';

// App shell — always cached
const APP_SHELL = [
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap',
];

// ─── Install ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ─── Activate — clean old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME, PHOTO_CACHE, INAT_CACHE];
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => !keep.includes(n))
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch strategy ──────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // iNat API calls: network-first, cache fallback (stale-while-revalidate)
  if (url.hostname === 'api.inaturalist.org') {
    event.respondWith(
      caches.open(INAT_CACHE).then(async (cache) => {
        try {
          const networkResp = await fetch(event.request);
          if (networkResp.ok) {
            cache.put(event.request, networkResp.clone());
          }
          return networkResp;
        } catch {
          const cached = await cache.match(event.request);
          return cached || new Response('{"results":[]}', {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // iNat/static photo URLs: cache-first with long expiry
  if (
    url.hostname.includes('inaturalist') ||
    url.hostname.includes('staticflickr') ||
    url.hostname.includes('static.inaturalist.org')
  ) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // ESRI tiles: cache-first
  if (url.hostname.includes('arcgisonline') || url.hostname.includes('esri')) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // App shell: cache-first, network fallback
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
