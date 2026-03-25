const CACHE_NAME='labugs-v3003';
const DATA_GROUPS=['butterflies','bumblebees','dragonflies','hoverflies','nativeBees','arachnids','moths','wasps','beetles','trueBugs','orthoptera','flies','snails','myriapods','isopods'];
const CORE=['/', '/index.html', '/manifest.json'];
const DATA=DATA_GROUPS.map(g=>'data/'+g+'.json');
const ALL=CORE.concat(DATA);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ALL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(c=>{if(c)return c;return fetch(e.request).then(r=>{if(e.request.url.includes('/data/')){const cl=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,cl));}return r;});}).catch(()=>caches.match('/index.html'))));
