/**
 * IPORDISE – Service Worker
 * Strategy:
 *   - Static assets (CSS, JS, fonts, images) → Cache-First
 *   - HTML pages → Network-First with cache fallback
 *   - External CDN resources → Stale-While-Revalidate
 */

const CACHE_VERSION = 'v6';
const STATIC_CACHE  = `ipordise-static-${CACHE_VERSION}`;
const HTML_CACHE    = `ipordise-pages-${CACHE_VERSION}`;
const CDN_CACHE     = `ipordise-cdn-${CACHE_VERSION}`;

/* ── Assets to pre-cache on install ── */
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/discover.html',
    '/style.css',
    '/script.js',
    '/i18n.js',
    '/pages/cart.html',
    '/pages/checkout.html',
    '/pages/product.html',
    '/pages/login.html',
    '/pages/contact.html',
    '/pages/track-order.html',
    '/pages/our-story.html',
    '/pages/faq.html',
    '/pages/cart.js',
    '/pages/checkout.js',
    '/assets/favicon.svg',
    '/assets/img_1.png',
    '/manifest.json',
    '/offline.html',
    '/404.html'
];

/* ── Offline fallback page ── */
const OFFLINE_URL = '/offline.html';

/* ───────── INSTALL ───────── */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(
                PRECACHE_ASSETS.filter((url) => !url.endsWith('offline.html'))
            ).catch(() => {/* Silently ignore individual fetch failures */});
        }).then(() => self.skipWaiting())
    );
});

/* Handle SKIP_WAITING message from client */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/* ───────── ACTIVATE ───────── */
self.addEventListener('activate', (event) => {
    const allowedCaches = [STATIC_CACHE, HTML_CACHE, CDN_CACHE];
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => !allowedCaches.includes(key))
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

/* ───────── FETCH ───────── */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // ── DEV BYPASS: disable all SW caching on local preview environments ──
    const isLocalPreview = self.location.hostname === 'localhost'
        || self.location.hostname === '127.0.0.1'
        || self.location.hostname === '0.0.0.0'
        || self.location.protocol === 'file:';
    if (isLocalPreview) return;

    // Skip non-GET, chrome-extension, and analytics
    if (
        request.method !== 'GET' ||
        url.protocol === 'chrome-extension:' ||
        url.hostname === 'www.googletagmanager.com' ||
        url.hostname === 'www.google-analytics.com'
    ) return;

    // External CDN (fonts, FA icons, tailwind) → Stale-While-Revalidate
    const externalCDN = [
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'cdnjs.cloudflare.com',
        'cdn.tailwindcss.com'
    ];
    if (externalCDN.some((h) => url.hostname.includes(h))) {
        event.respondWith(staleWhileRevalidate(CDN_CACHE, request));
        return;
    }

    // Static assets: CSS, JS, JSON → Stale-While-Revalidate (always refreshes in background)
    // Images, fonts, SVG → Cache-First (rarely change, safe to cache long-term)
    if (
        url.origin === self.location.origin &&
        (
            request.destination === 'style' ||
            request.destination === 'script' ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.json')
        )
    ) {
        event.respondWith(staleWhileRevalidate(STATIC_CACHE, request));
        return;
    }

    if (
        url.origin === self.location.origin &&
        (
            request.destination === 'image' ||
            request.destination === 'font' ||
            url.pathname.includes('/assets/') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.webp') ||
            url.pathname.endsWith('.woff2')
        )
    ) {
        event.respondWith(cacheFirst(STATIC_CACHE, request));
        return;
    }

    // HTML pages → Network-First with offline fallback
    if (
        url.origin === self.location.origin &&
        (request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/')
    ) {
        event.respondWith(networkFirst(HTML_CACHE, request));
        return;
    }
});

/* ═══ Strategies ═══ */

async function cacheFirst(cacheName, request) {
    const cache   = await caches.open(cacheName);
    const cached  = await cache.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
    }
}

async function networkFirst(cacheName, request) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
            return response;
        }
        // Server returned 404 (or other error) → serve our branded 404 page
        if (response.status === 404) {
            const notFound = await caches.match('/404.html');
            if (notFound) return notFound;
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        // Return offline page for navigation requests
        const offline = await caches.match(OFFLINE_URL);
        return offline || new Response('<h1>You are offline</h1>', {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

async function staleWhileRevalidate(cacheName, request) {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => null);
    return cached || await fetchPromise;
}

/* ───────── Background Sync (future orders) ───────── */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-order') {
        event.waitUntil(syncPendingOrders());
    }
});

async function syncPendingOrders() {
    try {
        const db    = await openDB();
        const store = db.transaction('pending-orders', 'readwrite').objectStore('pending-orders');
        const all   = await store.getAll();
        for (const order of all) {
            try {
                await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });
                store.delete(order.id);
            } catch { /* keep for next sync */ }
        }
    } catch { /* IndexedDB unavailable */ }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('ipordise-db', 1);
        req.onsuccess  = () => resolve(req.result);
        req.onerror    = () => reject(req.error);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore('pending-orders', { keyPath: 'id' });
        };
    });
}
