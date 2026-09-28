// Replaced with public, build-specific paths and a content-derived version.
const settings = __CES_PWA_SETTINGS__;
const cacheName = settings.prefix + settings.version;
const staticUrls = new Set(settings.urls.map((path) => new URL(path, self.location.origin).href));

self.addEventListener('install', (event) => {
  // No skipWaiting here: an existing version stays active until accepted.
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    try {
      for (const path of settings.urls) {
        const response = await fetch(new Request(path, { cache: 'reload' }));
        if (!response.ok || response.type === 'opaque') throw new Error('Shell unavailable');
        await cache.put(path, response);
      }
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(settings.prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CES_CATALOG_ACTIVATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate' && (url.pathname === settings.base || url.pathname === settings.base + 'index.html')) {
    event.respondWith((async () => {
      try {
        // Online HTML is never stored: it may contain prerendered products.
        return await fetch(request);
      } catch {
        return (await caches.open(cacheName)).match(settings.base + 'offline.html');
      }
    })());
    return;
  }
  // Exact allowlist only. API, product photos, analytics and all other requests
  // pass through unchanged; no runtime caches or response persistence.
  if (staticUrls.has(request.url)) {
    event.respondWith((async () => (await (await caches.open(cacheName)).match(request)) ?? fetch(request))());
  }
});
