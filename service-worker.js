const CACHE = 'lerunners-halloween-2026-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './assets/icones/favicon.svg', './assets/icones/icone-192.png', './assets/fotos/302971.jpg', './assets/fotos/76107.jpg', './assets/fotos/143240.jpg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lerunners-halloween-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(r => { if(r.ok){ const clone=r.clone(); caches.open(CACHE).then(cache=>cache.put('./index.html',clone)); } return r; }).catch(()=>caches.match('./index.html')));
    return;
  }
  if (/\.(?:jpg|png|webp|svg|webmanifest|css)$/.test(url.pathname)) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(r => { if (r.ok){const clone=r.clone(); caches.open(CACHE).then(cache=>cache.put(req,clone));} return r;})));
  }
});
