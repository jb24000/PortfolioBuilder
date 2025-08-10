const CACHE_NAME = 'portfolio-builder-v1';
const OFFLINE_URL = '/PortfolioBuilder/offline.html';
const urlsToCache = [
  '/PortfolioBuilder/',
  '/PortfolioBuilder/index.html',
  '/PortfolioBuilder/offline.html',
  '/PortfolioBuilder/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache resources including offline page
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All resources cached');
        self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('Cache add failed:', error);
      })
  );
});

// Fetch event - serve from cache or show offline page
self.addEventListener('fetch', (event) => {
  // Handle navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If fetch fails, serve offline page
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Handle all other requests
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(event.request).catch((error) => {
          console.error('Fetch failed for:', event.request.url, error);
          
          // For manifest.json requests (used for connectivity checks), return a minimal response
          if (event.request.url.includes('manifest.json')) {
            return new Response('{"name":"Portfolio Builder"}', {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // For other requests, let them fail naturally
          throw error;
        });
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Message handling for offline page communication
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'GET_CACHED_PROJECT':
      // Try to get cached project data from localStorage equivalent
      // Since SW can't access localStorage, we'll check if there's cached data
      caches.open(CACHE_NAME).then(cache => {
        // In a real implementation, you might store project data differently
        // For now, we'll send back a simple response
        event.ports[0].postMessage({
          type: 'CACHED_PROJECT',
          project: null // You could implement proper project caching here
        });
      });
      break;
      
    case 'CACHE_PROJECT':
      // Cache project data
      if (data && data.project) {
        // Store project data in a separate cache
        caches.open('portfolio-projects-cache').then(cache => {
          const projectResponse = new Response(JSON.stringify(data.project), {
            headers: { 'Content-Type': 'application/json' }
          });
          return cache.put('/current-project', projectResponse);
        });
      }
      break;
      
    case 'GET_CACHE_STATUS':
      // Return cache status
      caches.keys().then(cacheNames => {
        event.ports[0].postMessage({
          type: 'CACHE_STATUS',
          caches: cacheNames,
          available: cacheNames.includes(CACHE_NAME)
        });
      });
      break;
  }
});

// Background sync for saving projects
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    event.waitUntil(
      // Handle background synchronization
      syncProjects()
    );
  }
});

async function syncProjects() {
  try {
    // Get cached project data
    const cache = await caches.open('portfolio-projects-cache');
    const response = await cache.match('/current-project');
    
    if (response) {
      const project = await response.json();
      console.log('Project data ready for sync:', project.title);
      // Here you could sync to a cloud service when online
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/PortfolioBuilder/icons/icon-192.png',
      badge: '/PortfolioBuilder/icons/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/PortfolioBuilder/')
  );
});
