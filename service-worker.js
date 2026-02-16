const CACHE_VERSION = 'solar-system-v1';
const CACHE_ASSETS = [
  '/solar-system-adventure/',
  '/solar-system-adventure/index.html',
  '/solar-system-adventure/space-music.mp3'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CACHE_ASSETS).catch(() => {
        // Gracefully handle if audio file is missing
        return cache.addAll(CACHE_ASSETS.filter(url => !url.includes('.mp3')));
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - StaleWhileRevalidate strategy
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // For HTML documents, use StaleWhileRevalidate
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((response) => {
          // Only cache successful responses
          if (response && response.status === 200 && !response.redirected) {
            const responseToCache = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // If network fails and no cache, return offline page
          return cachedResponse || new Response('Offline - please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });

        // Return cached version immediately, update in background
        return cachedResponse || fetchPromise;
      })
    );
  } else {
    // For other assets (CSS, JS, images, audio), use CacheFirst strategy
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          // Cache successful responses
          if (response && response.status === 200 && !response.redirected) {
            const responseToCache = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // Return nothing for failed assets (graceful degradation)
          return new Response('', { status: 404 });
        });
      })
    );
  }
});
