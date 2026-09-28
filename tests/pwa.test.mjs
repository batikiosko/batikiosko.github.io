import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { finalizePwa } from '../scripts/pwa-build.mjs';
import { resolveCatalogConfig } from '../src/catalog/config.mjs';
import { createManifest } from '../src/pwa/manifest.mjs';
import { renderHead } from '../src/catalog/html.mjs';
import { createPwaClient, isStandalone } from '../src/pwa/client.mjs';

const profile = (name) => JSON.parse(readFileSync(new URL(`../config/businesses/${name}.json`, import.meta.url), 'utf8'));
for (const name of ['batikiosco', 'demo']) for (const base of ['/', '/catalogo/']) {
  test(`${name}: iOS metadata and manifest agree at ${base}`, () => {
    const config = resolveCatalogConfig(profile(name), { VITE_PUBLIC_URL: `https://example.test${base}` });
    const head = renderHead(config), manifest = createManifest(config);
    assert.ok(head.includes('<meta name="apple-mobile-web-app-capable" content="yes" />'));
    assert.ok(head.includes(`<meta name="apple-mobile-web-app-title" content="${manifest.short_name}" />`));
    assert.ok(head.includes(`<link rel="manifest" href="${base}manifest.webmanifest" />`));
    assert.equal(manifest.display, 'standalone');
    const start = new URL(manifest.start_url, config.publicUrl), scope = new URL(manifest.scope, config.publicUrl);
    assert.equal(start.origin, scope.origin); assert.ok(start.pathname.startsWith(scope.pathname));
    assert.equal(manifest.id, base);
    if (name === 'demo') assert.doesNotMatch(head, /batikiosco|batikiosko/i);
    const custom = renderHead({ ...config, pwa: { ...config.pwa, shortName: 'CES & "Tienda"' } });
    assert.ok(custom.includes('content="CES &amp; &quot;Tienda&quot;"'));
  });
}
for (const base of ['/', '/catalogo/']) {
  test(`manifest identity, paths and required icons at ${base}`, () => {
    const config = resolveCatalogConfig(profile('demo'), { VITE_PUBLIC_URL: `https://example.test${base}` });
    const manifest = createManifest(config);
    assert.equal(manifest.id, base); assert.equal(manifest.scope, base); assert.equal(manifest.start_url, base);
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.name, config.business.name);
    assert.equal(manifest.theme_color, config.branding.primary);
    assert.equal(manifest.background_color, config.branding.paper);
    assert.equal(manifest.icons.length, 3);
    assert.doesNotMatch(JSON.stringify(manifest), /batikiosco|batikiosko/i);
    assert.notEqual(manifest.name, createManifest(resolveCatalogConfig(profile('batikiosco'))).name);
  });
}
test('missing or invalid PWA icons fail configuration without borrowing branding', () => {
  const demo = profile('demo');
  assert.throws(() => resolveCatalogConfig({ ...demo, pwa: {} }), /iconos/);
  assert.throws(() => resolveCatalogConfig({ ...demo, pwa: { icons: [demo.pwa.icons[0]] } }), /512/);
  assert.throws(() => resolveCatalogConfig({ ...demo, pwa: { icons: [{ ...demo.pwa.icons[0], purpose: 'invalid' }] } }), /inválido/);
});

test('finalizer versions actual build contents, isolates subpaths and excludes snapshots/leftovers', async () => {
  const artifacts = new URL('../.browser-check/', import.meta.url);
  await mkdir(artifacts, { recursive: true });
  const directory = await mkdtemp(new URL('unit-pwa-', artifacts));
  await mkdir(resolve(directory, 'assets'));
  await writeFile(resolve(directory, 'assets/app.js'), 'current build');
  await writeFile(resolve(directory, 'assets/old.js'), 'leftover build');
  await writeFile(resolve(directory, 'index.html'), '<div>Prerendered price</div>');
  await writeFile(resolve(directory, 'manifest.webmanifest'), '{}');
  await writeFile(resolve(directory, 'pwa-assets.json'), '["assets/app.js"]');
  const config = resolveCatalogConfig(profile('demo'));
  const html = '<html><body><div id="root"></div></body></html>';
  const first = await finalizePwa(directory, config, html);
  const same = await finalizePwa(directory, config, html);
  assert.equal(first.version, same.version);
  assert.equal(first.base, '/negocio/');
  assert.deepEqual(first.urls, ['/negocio/assets/app.js', '/negocio/manifest.webmanifest', '/negocio/offline.html']);
  assert.doesNotMatch(await readFile(resolve(directory, 'offline.html'), 'utf8'), /Prerendered price/);
  assert.match(await readFile(resolve(directory, 'offline.html'), 'utf8'), /Sin conexión/);
  assert.doesNotMatch(await readFile(resolve(directory, 'sw.js'), 'utf8'), /__CES_PWA_SETTINGS__|old\.js|Batikiosco/);
  await writeFile(resolve(directory, 'assets/app.js'), 'new build');
  assert.notEqual((await finalizePwa(directory, config, html)).version, first.version);
  const root = { ...config, publicUrl: 'https://example.test/' };
  assert.notEqual((await finalizePwa(directory, root, html)).prefix, first.prefix);
});

function worker(base = '/catalogo/') {
  const origin = 'https://example.test', handlers = {}, stores = new Map(), fetched = [];
  const settings = { base, prefix: 'ces-catalog-scope-', version: 'v2', urls: [base + 'offline.html', base + 'assets/app.js'] };
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return { put: async (request, response) => entries.set(key(request), response), match: async (request) => entries.get(key(request)) };
    },
    keys: async () => [...stores.keys()], delete: async (name) => stores.delete(name),
  };
  let fail = false, skipped = 0, claimed = 0;
  const self = { location: { origin }, clients: { claim: async () => { claimed++; } }, skipWaiting: async () => { skipped++; }, addEventListener: (name, fn) => { handlers[name] = fn; } };
  const BrowserRequest = function(url, options) { return new Request(new URL(url, origin), options); };
  runInNewContext(readFileSync(new URL('../src/pwa/service-worker.js', import.meta.url), 'utf8').replace('__CES_PWA_SETTINGS__', JSON.stringify(settings)), {
    self, caches, Request: BrowserRequest, URL, Set,
    fetch: async (request) => { if (fail) throw new Error('offline'); fetched.push(key(request)); return new Response('static-shell'); },
  });
  const lifecycle = async (name, data) => { let pending; handlers[name]({ data, waitUntil: (promise) => { pending = promise; } }); await pending; };
  const fetchRequest = async (url, options = {}) => {
    let response;
    handlers.fetch({ request: { url: new URL(url, origin).href, method: 'GET', mode: 'cors', headers: new Headers(), ...options }, respondWith: (promise) => { response = promise; } });
    return response ? await response : null;
  };
  return { settings, stores, fetched, lifecycle, fetchRequest, offline: () => { fail = true; }, get skipped() { return skipped; }, get claimed() { return claimed; } };
}
for (const base of ['/', '/catalogo/']) {
  test(`worker caches allowlist, opens shell offline, bypasses API/auth/photos at ${base}`, async () => {
    const sw = worker(base); await sw.lifecycle('install');
    assert.equal(sw.skipped, 0);
    assert.equal(sw.stores.get('ces-catalog-scope-v2').size, 2);
    for (const path of ['/public/catalog?companyId=a', '/admin/private', base + 'product.jpg', 'https://api.other.test/public/catalog', base + 'assets/app.js?token=private']) assert.equal(await sw.fetchRequest(path), null);
    assert.equal(await sw.fetchRequest(base + 'assets/app.js', { headers: new Headers({ Authorization: 'Bearer fake' }) }), null);
    assert.equal(await sw.fetchRequest(base + 'assets/app.js', { method: 'POST' }), null);
    assert.equal(await sw.fetchRequest('/another/', { mode: 'navigate' }), null);
    sw.offline();
    assert.equal(await (await sw.fetchRequest(base, { mode: 'navigate' })).text(), 'static-shell');
    assert.equal(await (await sw.fetchRequest(base + 'assets/app.js')).text(), 'static-shell');
    assert.equal(sw.stores.get('ces-catalog-scope-v2').size, 2);
  });
}
test('worker deletes only its previous cache namespace and activates only on explicit message', async () => {
  const sw = worker();
  sw.stores.set('ces-catalog-scope-v1', new Map()); sw.stores.set('other-cache', new Map()); sw.stores.set('ces-catalog-another-v1', new Map());
  await sw.lifecycle('install'); await sw.lifecycle('activate');
  assert.deepEqual([...sw.stores.keys()].sort(), ['ces-catalog-another-v1', 'ces-catalog-scope-v2', 'other-cache']);
  assert.equal(sw.claimed, 1);
  await sw.lifecycle('message', { type: 'other' }); assert.equal(sw.skipped, 0);
  await sw.lifecycle('message', { type: 'CES_CATALOG_ACTIVATE' }); assert.equal(sw.skipped, 1);
});
test('failed precache cannot leave a partial version installed', async () => {
  const sw = worker(); sw.offline();
  await assert.rejects(sw.lifecycle('install'), /offline/);
  assert.equal(sw.stores.size, 0);
});

function browserMock({ installed = false, ios = false, waiting = false } = {}) {
  const media = Object.assign(new EventTarget(), { matches: installed });
  const registration = Object.assign(new EventTarget(), { waiting: waiting ? { postMessage(message) { registration.message = message; } } : null, installing: null, update: async () => {} });
  const sw = Object.assign(new EventTarget(), { controller: {}, register: async (url, options) => { sw.url = url; sw.options = options; return registration; } });
  let reloads = 0;
  const browser = Object.assign(new EventTarget(), { isSecureContext: true, matchMedia: () => media, document: Object.assign(new EventTarget(), { visibilityState: 'visible' }), location: { reload: () => { reloads++; } } });
  const navigator = { onLine: true, serviceWorker: sw, userAgent: ios ? 'iPhone' : 'Chromium', standalone: false };
  const client = createPwaClient(browser, navigator, '/catalogo/', true);
  return { browser, navigator, sw, media, registration, client, get reloads() { return reloads; } };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
test('install prompt is optional, used once and hidden after appinstalled', async () => {
  const mock = browserMock(); mock.client.start();
  assert.equal(mock.client.getSnapshot().canInstall, false);
  let prompts = 0;
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => { prompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  mock.browser.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
  assert.equal(mock.client.getSnapshot().canInstall, true);
  await mock.client.install(); await mock.client.install(); assert.equal(prompts, 1);
  mock.browser.dispatchEvent(new Event('appinstalled'));
  assert.equal(mock.client.getSnapshot().installed, true); assert.equal(mock.client.getSnapshot().canInstall, false);
  mock.client.stop(); await settle();
});
test('standalone and iOS detection adapt installation UI without blocking the catalog', () => {
  const mock = browserMock({ ios: true }); mock.client.start();
  assert.equal(mock.client.getSnapshot().manual, true);
  mock.media.matches = true; mock.media.dispatchEvent(new Event('change'));
  assert.equal(mock.client.getSnapshot().manual, false);
  mock.media.matches = false;
  assert.equal(isStandalone(mock.browser, { standalone: false }), false);
  assert.equal(isStandalone(mock.browser, { standalone: true }), true);
  mock.client.stop();
});
test('offline state follows connectivity and recovers', () => {
  const mock = browserMock(); mock.client.start();
  mock.navigator.onLine = false; mock.browser.dispatchEvent(new Event('offline')); assert.equal(mock.client.getSnapshot().offline, true);
  mock.navigator.onLine = true; mock.browser.dispatchEvent(new Event('online')); assert.equal(mock.client.getSnapshot().offline, false);
  mock.client.stop();
});
test('waiting update requires acceptance and reloads exactly once, never on initial activation', async () => {
  const mock = browserMock({ waiting: true }); mock.client.start(); await settle();
  assert.equal(mock.sw.url, '/catalogo/sw.js'); assert.equal(mock.sw.options.scope, '/catalogo/'); assert.equal(mock.sw.options.updateViaCache, 'none');
  assert.equal(mock.client.getSnapshot().updateAvailable, true);
  mock.sw.dispatchEvent(new Event('controllerchange')); assert.equal(mock.reloads, 0);
  mock.client.activate(); assert.deepEqual(mock.registration.message, { type: 'CES_CATALOG_ACTIVATE' });
  mock.sw.dispatchEvent(new Event('controllerchange')); mock.sw.dispatchEvent(new Event('controllerchange'));
  assert.equal(mock.reloads, 1); mock.client.stop();
});

test('a newly installed update becomes available without automatically activating it', async () => {
  const mock = browserMock(); mock.client.start(); await settle();
  assert.equal(mock.client.getSnapshot().updateAvailable, false);
  const worker = Object.assign(new EventTarget(), { state: 'installing' });
  mock.registration.installing = worker; mock.registration.dispatchEvent(new Event('updatefound'));
  mock.registration.waiting = { postMessage() {} }; worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
  assert.equal(mock.client.getSnapshot().updateAvailable, true); assert.equal(mock.reloads, 0);
  mock.client.stop();
});
