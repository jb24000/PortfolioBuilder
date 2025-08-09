// Service Worker for Portfolio Builder
// Version 1.0.0

const CACHE_NAME = 'portfolio-builder-v1.0.0';
const DYNAMIC_CACHE = 'portfolio-builder-dynamic-v1.0.0';

// Core assets to cache immediately
const STATIC_ASSETS = [
  '/PortfolioBuilder/',
  '/PortfolioBuilder/index.html',
  '/PortfolioBuilder/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
     .filter((cacheName) => {
          return cacheName.startsWith('portfolio-builder-') && 
                 cacheName !== CACHE_NAME && 
                 cacheName !== DYNAMIC_CACHE;
})
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Network-first strategy for API calls
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Update cache in background
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE)
                  .then((cache) => cache.put(request, responseClone));
              }
            })
            .catch(() => {});
          
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => cache.put(request, responseClone));

            return response;
          });
      })
      .catch(() => {
        // If both cache and network fail, show offline page for navigation
        if (request.mode === 'navigate') {
          return caches.match('/PortfolioBuilder/offline.html');
        }
        
        // Return a basic error response for other requests
        return new Response('Network error occurred', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      })
  );
});

// Handle background sync for saving projects
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered');
  
  if (event.tag === 'sync-project') {
    event.waitUntil(syncProject());
  }
});

// Sync project data when connection is restored
async function syncProject() {
  try {
    // Get project data from IndexedDB or localStorage
    const clients = await self.clients.matchAll();
    
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_PROJECT',
        message: 'Syncing project data...'
      });
    }
    
    console.log('[Service Worker] Project synced successfully');
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    throw error;
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');
  
  const options = {
    title: 'Documentation Reminder',
    body: event.data ? event.data.text() : 'Don\'t forget to document your projects!',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiMxMTExMTEiLz4KPHBhdGggZD0iTTYwIDYwSDEzMlY3Mkg2MFY2MFpNNjAgOTBIMTMyVjEwMkg2MFY5MFpNNjAgMTIwSDEwMlYxMzJINjBWMTIwWiIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4=',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiByeD0iMTYiIGZpbGw9IiMxMTExMTEiLz48cGF0aCBkPSJNMzAgMzBINjZWMzhIMzBWMzBaTTMwIDQ0SDY2VjUySDMwVjQ0Wk0zMCA1OEg1MVY2NkgzMFY1OFoiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik0xMiAyTDIgN3Y5YzAgNS41IDMuODQgMTAuNzQgOSAxMS44M1YyMGgydjcuODNjNS4xNi0xLjA5IDktNi4zMyA5LTExLjgzVjdMMTIgMnoiIGZpbGw9IiNmZmYiLz48L3N2Zz4='
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik0xOSA2LjQxTDE3LjU5IDUgMTIgMTAuNTkgNi40MSA1IDUgNi40MSAxMC41OSAxMiA1IDE3LjU5IDYuNDEgMTkgMTIgMTMuNDEgMTcuNTkgMTkgMTkgMTcuNTkgMTMuNDEgMTIgMTkgNi40MXoiIGZpbGw9IiNmZmYiLz48L3N2Zz4='
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Portfolio Builder', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/PortfolioBuilder/')
    );
  }
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_PROJECT') {
    // Cache project data
    const projectData = event.data.project;
    caches.open(DYNAMIC_CACHE)
      .then((cache) => {
        const response = new Response(JSON.stringify(projectData), {
          headers: { 'Content-Type': 'application/json' }
        });
        cache.put('/cached-project', response);
      });
  }
  
  if (event.data.type === 'GET_CACHED_PROJECT') {
    // Retrieve cached project
    caches.match('/cached-project')
      .then((response) => {
        if (response) {
          response.json().then((data) => {
            event.ports[0].postMessage({
              type: 'CACHED_PROJECT',
              project: data
            });
          });
        } else {
          event.ports[0].postMessage({
            type: 'NO_CACHED_PROJECT'
          });
        }
      });
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME) {
                return caches.delete(cacheName);
              }
            })
          );
        })
    );
  }
});

// Cache size management
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(
      keysToDelete.map(key => cache.delete(key))
    );
    console.log(`[Service Worker] Trimmed ${keysToDelete.length} items from ${cacheName}`);
  }
}

// Periodic cache cleanup (every 24 hours)
setInterval(() => {
  trimCache(DYNAMIC_CACHE, 50);
}, 24 * 60 * 60 * 1000);

console.log('[Service Worker] Loaded successfully');
