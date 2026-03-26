/**
 * Pulse PWA Service Worker
 * Handles caching, background sync, and push notifications
 * @version 1.0.0
 */

const CACHE_VERSION = 'pulse-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Critical assets to cache on install
const CRITICAL_ASSETS = [
  '/pulse',
  '/pulse/',
  '/assets/pulse/favicon.svg',
  '/assets/pulse/icon-192.png',
  '/assets/pulse/icon-512.png'
];

// Routes that should use network-first strategy
const API_ROUTES = [
  '/api/method/pulse.api',
  '/api/method/frappe.auth',
  '/api/method/frappe.desk'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('pulse-') && !name.includes(CACHE_VERSION))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
      .catch((err) => console.error('[SW] Activation failed:', err))
  );
});

// Helper: Check if URL is an API call
function isApiRequest(url) {
  return API_ROUTES.some(route => url.includes(route));
}

// Helper: Check if URL is an image
function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url);
}

// Helper: Check if request is for a static asset
function isStaticAsset(url) {
  return url.includes('/assets/') || 
         url.includes('.js') || 
         url.includes('.css') ||
         url.includes('.woff') ||
         url.includes('.woff2');
}

// Fetch event - handle caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests for caching (but allow for network)
  if (request.method !== 'GET') {
    // Handle POST/PUT/DELETE for background sync
    if (!navigator.onLine && (request.method === 'POST' || request.method === 'PUT')) {
      event.respondWith(queueForSync(request));
    }
    return;
  }
  
  // API requests - Network first, cache fallback
  if (isApiRequest(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Image requests - Cache first with network fallback
  if (isImageRequest(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }
  
  // Static assets - Cache first with network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }
  
  // Navigation requests - Network first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Default: Network first
  event.respondWith(networkFirstStrategy(request));
});

// Network First Strategy - Try network, fallback to cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Update cache with fresh response
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for navigation
    if (request.mode === 'navigate') {
      return caches.match('/pulse');
    }
    
    throw error;
  }
}

// Cache First Strategy - Try cache, fallback to network
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Refresh cache in background
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, networkResponse);
        });
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

// Queue request for background sync
async function queueForSync(request) {
  const clone = request.clone();
  const body = await clone.text();
  
  const syncItem = {
    id: Date.now().toString(),
    url: request.url,
    method: request.method,
    headers: Array.from(request.headers.entries()),
    body: body,
    timestamp: Date.now()
  };
  
  // Store in IndexedDB for later sync
  await saveToSyncQueue(syncItem);
  
  // Register for background sync
  if ('sync' in self.registration) {
    await self.registration.sync.register('pulse-sync');
  }
  
  // Return a mock response
  return new Response(JSON.stringify({ 
    message: 'Queued for sync',
    queued: true,
    id: syncItem.id
  }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
}

// IndexedDB helpers for sync queue
const DB_NAME = 'pulse-sync-db';
const DB_VERSION = 1;
const STORE_NAME = 'sync-queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveToSyncQueue(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(item);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getSyncQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeFromSyncQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Background Sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'pulse-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(processSyncQueue());
  }
});

// Process the sync queue
async function processSyncQueue() {
  const queue = await getSyncQueue();
  
  if (queue.length === 0) return;
  
  console.log(`[SW] Processing ${queue.length} queued items`);
  
  const results = await Promise.allSettled(
    queue.map(async (item) => {
      try {
        const headers = new Headers(item.headers);
        
        const response = await fetch(item.url, {
          method: item.method,
          headers: headers,
          body: item.body
        });
        
        if (response.ok) {
          await removeFromSyncQueue(item.id);
          return { success: true, id: item.id };
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('[SW] Sync failed for item:', item.id, error);
        return { success: false, id: item.id, error: error.message };
      }
    })
  );
  
  // Notify clients about sync completion
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETED',
      results: results.map(r => r.value || r.reason)
    });
  });
  
  return results;
}

// Periodic Background Sync (for updates)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'pulse-update-check') {
    console.log('[SW] Periodic sync: checking for updates');
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  // Notify clients to check for updates
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'CHECK_FOR_UPDATES' });
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: event.data?.text() || 'Pulse Notification' };
  }
  
  const title = data.title || 'Pulse';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/assets/pulse/icon-192.png',
    badge: '/assets/pulse/icon-192.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {}
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = data.url || '/pulse';
  
  // Handle action clicks
  if (event.action) {
    switch (event.action) {
      case 'view':
        url = data.url || '/pulse/tasks';
        break;
      case 'dismiss':
        return;
      case 'complete':
        // Handle complete action
        event.waitUntil(
          fetch('/api/method/pulse.api.sync.process_action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'complete', taskId: data.taskId })
          }).catch(() => {})
        );
        return;
    }
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes('/pulse') && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url });
            return;
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Message handling from clients
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_SYNC_STATUS':
      event.ports[0]?.postMessage({
        type: 'SYNC_STATUS',
        pendingCount: getSyncQueue().then(q => q.length)
      });
      break;
      
    case 'FORCE_SYNC':
      event.waitUntil(processSyncQueue());
      break;
      
    case 'CACHE_URLS':
      if (payload?.urls) {
        event.waitUntil(
          caches.open(STATIC_CACHE).then(cache => 
            cache.addAll(payload.urls)
          )
        );
      }
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(names => 
          Promise.all(names.map(name => caches.delete(name)))
        )
      );
      break;
  }
});

console.log('[SW] Service Worker loaded');
