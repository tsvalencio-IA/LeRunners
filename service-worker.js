const CACHE = 'lerunners-corrida-17bpmi-20261108-v5-criancas-gratis';
const SHELL = ['./', './index.html', './app.js', './payments.js', './manifest.webmanifest', './assets/icones/favicon.svg', './assets/icones/icone-192.png', './assets/icones/icone-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(SHELL.map(url => cache.add(url)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('lerunners-halloween-') || key.startsWith('lerunners-encontro-') || key.startsWith('lerunners-corrida-17bpmi-')) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
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
