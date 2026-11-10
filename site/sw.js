// Replaced with public, build-specific paths and a content-derived version.
const settings = {"base":"/","prefix":"ces-catalog-8a5edab282632443-","version":"34af3bbbae4e9c5f","urls":["/assets/aseo-a7257fec2c.jpeg","/assets/batikiosco-192-02cfa47f6d.png","/assets/batikiosco-512-00b78f3acf.png","/assets/batikiosco-apple-180-bb2fc312f2.png","/assets/batikiosco-maskable-512-8dbd235424.png","/assets/bebidas-alcoholicas-783519ef64.jpeg","/assets/bebidas-sin-alcohol-e50b6d10bf.jpeg","/assets/catalog-qr-c5fcfbd556.png","/assets/cigarros-541b2e5774.jpeg","/assets/comestible-1872eaa68d.jpeg","/assets/confitura-2e871549c6.jpeg","/assets/favicon-16x16-e9e894e0a9.png","/assets/favicon-32x32-3b35832d79.png","/assets/favicon-48x48-ace42d8f78.png","/assets/index-DMK5vWwm.css","/assets/index-Dqj5Ph5S.js","/assets/logo-batikiosco-transparent-dd39330894.png","/assets/og-image-042ecc9f51.png","/manifest.webmanifest","/offline.html"]};
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

// 2.19.0: avisos de puntos (push). El servidor manda { title, body, tag, url } cifrado para este teléfono; si llega
// vacío o roto igual se muestra algo, porque el navegador exige mostrar un aviso por cada push recibido.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Tus puntos';
  const body = typeof data.body === 'string' ? data.body : 'Tienes un aviso nuevo de tus puntos.';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    icon: settings.base + 'icon-512.png',
    badge: settings.base + 'favicon-48x48.png',
    data: { url: settings.base + '#mis-puntos' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? settings.base, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).pathname.startsWith(settings.base)) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
