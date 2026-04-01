const CACHE_NAME='labugs-v3028';
const D=['butterflies','bumblebees','dragonflies','hoverflies','nativeBees','arachnids','moths','wasps','beetles','trueBugs','orthoptera','flies','snails','myriapods','isopods'];
const ICONS=['icons/app-icon-128x128.png','icons/app-icon-180x180.png','icons/app-icon-192x192.png','icons/app-icon-512x512.png','icons/app-icon-1024x1024.png'];
const ASSETS=['/','/index.html','/manifest.json'].concat(D.map(g=>'data/'+g+'.json')).concat(ICONS);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE_NAME).then(cache=>cache.put(e.request,c));}return r;}).catch(()=>caches.match(e.request)));});
