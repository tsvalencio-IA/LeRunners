/* =================================================================== */
/* NOVO (V3.4): Service Worker Básico para PWA
/* =================================================================== */

const CACHE_NAME = 'lerunners-cache-v3.4';

// Arquivos que compõem o "App Shell"
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/app.html',
    '/css/styles.css',
    '/js/config.js',
    '/js/app.js',
    '/js/panels.js',
    '/manifest.json',
    '/img/logo-192.png',
    '/img/logo-512.png',
    'https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css', // CSS externo
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',
    'https://upload-widget.cloudinary.com/global/all.js'
];

// 1. Instalação (Cacheia o App Shell)
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando o App Shell');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Instalação completa.');
                return self.skipWaiting(); // Força o SW a ativar
            })
    );
});

// 2. Ativação (Limpa caches antigos)
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Limpando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Torna-se o SW ativo imediatamente
    );
});

// 3. Fetch (Serve do cache primeiro)
self.addEventListener('fetch', (event) => {
    // Não cacheia requisições do Firebase DB ou Gemini/Cloudinary (APIs)
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('cloudinary.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Tenta servir do cache
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    // console.log('[Service Worker] Servindo do cache:', event.request.url);
                    return response; // Encontrou no cache
                }
                
                // console.log('[Service Worker] Buscando na rede:', event.request.url);
                return fetch(event.request); // Não encontrou, busca na rede
            })
    );
});
