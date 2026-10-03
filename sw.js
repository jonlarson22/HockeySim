// sw.js — offline support for College Hockey Dynasty.
// Cache-first: the whole game is static files, so once visited it works offline.
const CACHE = 'hockeysim-v1';
const SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request, { ignoreSearch: true }).then((hit) => {
            if (hit) return hit;
            return fetch(e.request).then((res) => {
                // Only cache good same-origin responses.
                if (res.ok && new URL(e.request.url).origin === self.location.origin) {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, copy));
                }
                return res;
            }).catch(() => {
                // Offline and not cached: fall back to the app shell for navigations.
                if (e.request.mode === 'navigate') return caches.match('./index.html');
                throw new Error('offline');
            });
        })
    );
});
