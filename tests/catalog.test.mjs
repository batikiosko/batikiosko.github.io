import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCatalogConfig, catalogUrl } from '../src/catalog/config.mjs';
import { normalizeCatalog, productPricing, filterProducts, isNewProduct } from '../src/catalog/model.mjs';
import { buildSnapshot, renderHead, safeJsonLd, productStructuredData } from '../src/catalog/html.mjs';
import { requestCatalog } from '../src/catalog/request.mjs';

const profile = JSON.parse(readFileSync(new URL('../config/businesses/batikiosco.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../config/businesses/demo.json', import.meta.url), 'utf8'));
const config = resolveCatalogConfig(profile);
const product = (overrides = {}) => ({ id: 'p1', name: 'Producto', salePrice: '100', effectivePrice: '100', ...overrides });
const catalog = (products, currency = 'CUP') => normalizeCatalog({ currency, products }, config);

test('configuration preserves default identity and applies build overrides including device', () => {
  assert.equal(config.business.name, 'Batikiosco');
  const resolved = resolveCatalogConfig(demo, { VITE_COMPANY_ID: 'another-company', VITE_DEVICE_ID: 'counter-2', VITE_SYNC_SERVER_URL: 'https://api.example', VITE_PUBLIC_URL: 'https://catalog.example/client' });
  assert.equal(resolved.publicUrl, 'https://catalog.example/client/');
  const url = catalogUrl(resolved);
  assert.equal(url.origin, 'https://api.example');
  assert.equal(url.searchParams.get('companyId'), 'another-company');
  assert.equal(url.searchParams.get('deviceId'), 'counter-2');
  assert.equal(resolved.business.name, demo.business.name);
  assert.equal(catalogUrl(resolveCatalogConfig(demo, { VITE_DEVICE_ID: '' })).searchParams.has('deviceId'), false);
  assert.equal(profile.deviceId, null); // input remains unchanged
  assert.equal(resolveCatalogConfig(profile, { VITE_PUBLIC_URL: 'https://another.example/' }).assets.qr, undefined);
});

test('configuration fails early instead of silently borrowing another business', () => {
  assert.throws(() => resolveCatalogConfig(demo, { VITE_COMPANY_ID: '' }), /companyId/);
  assert.throws(() => resolveCatalogConfig(demo, { VITE_SYNC_SERVER_URL: 'javascript:alert(1)' }), /URL/);
  assert.throws(() => resolveCatalogConfig({ ...demo, assets: {} }), /assets.logo/);
  assert.throws(() => resolveCatalogConfig({ ...demo, branding: { ...demo.branding, fontBody: '</style>' } }), /Fuente/);
});

test('FAQ references canonical address and hours after profile changes', () => {
  const altered = structuredClone(profile);
  altered.business.address = 'Nueva dirección';
  altered.business.hours = 'Nuevo horario';
  const resolved = resolveCatalogConfig(altered);
  assert.equal(resolved.texts.faq[3].answer, 'En Nueva dirección.');
  assert.equal(resolved.texts.faq[4].answer, 'Nuevo horario.');
});

test('missing optional data receives safe defaults and primary categories are normalized', () => {
  const data = catalog([product({ category: ' Aseo ', categories: [' Aseo ', 'Aseo', '', 3], description: 'Descripción' })]);
  assert.deepEqual(data.products[0].categories, ['Aseo']);
  assert.deepEqual(data.products[0].catalogDetails, ['Descripción']);
  assert.deepEqual(data.products[0].galleryImages, []);
  assert.equal(data.products[0].imageUrl, null);
  assert.equal(data.companyName, config.business.name);
  assert.deepEqual(data.warnings, []);
});

test('bad individual products do not remove valid products, but unusable catalogs are explained', () => {
  const data = catalog([product(), product({ id: 'bad', salePrice: 'not-a-price' }), null]);
  assert.equal(data.products.length, 1);
  assert.equal(data.warnings.length, 2);
  assert.throws(() => catalog([product({ salePrice: '' })]), /incompletos/);
  assert.throws(() => normalizeCatalog({ currency: 'CUP' }, config), /incompatible/);
  assert.throws(() => normalizeCatalog({ products: [] }, config), /moneda/);
  assert.equal(normalizeCatalog({ products: [] }, resolveCatalogConfig(demo)).currency, 'CUP');
  assert.equal(catalog([]).products.length, 0);
});

test('product currency takes priority over catalog currency in snapshot and structured data', () => {
  const data = catalog([product({ salePrice: '10', effectivePrice: '10', priceCurrency: 'USD' })]);
  assert.equal(productPricing(data.products[0], data.currency).currency, 'USD');
  const html = buildSnapshot(data, config);
  assert.match(html, /10,00 USD/);
  assert.doesNotMatch(html, /10,00 CUP/);
  assert.equal(productStructuredData(data.products, data.currency, config)['@graph'][0].offers.priceCurrency, 'USD');
});

test('normal, simple and quantity offers preserve actual prices and conditions', () => {
  const data = catalog([
    product(),
    product({ id: 'simple', onOffer: true, effectivePrice: '90', offerFixedPrice: '90', offerPercent: '10' }),
    product({ id: 'quantity', onOffer: true, effectivePrice: '80', offerFixedPrice: '80', offerMinQuantity: '3', offerPercent: '20' }),
  ]);
  assert.deepEqual(data.products.map((p) => productPricing(p, data.currency).kind), ['normal', 'simple', 'quantity']);
  const html = buildSnapshot(data, config);
  assert.match(html, /Precio de lista: <s>100,00 CUP/);
  assert.match(html, /Precio: 90,00 CUP/);
  assert.match(html, /Precio normal: 100,00 CUP/);
  assert.match(html, /Oferta llevando 3 o más: 80,00 CUP c\/u/);
  assert.equal(data.products[2].effectivePrice, '100');
  const offers = productStructuredData(data.products, data.currency, config)['@graph'][2].offers;
  assert.equal(offers[0].price, '100');
  assert.equal(offers[1].price, '80');
  assert.equal(offers[1].eligibleQuantity.minValue, 3);
  assert.throws(() => catalog([product({ onOffer: true, offerMinQuantity: '3' })]), /incompletos/);
});

test('category filters combine with OR and intersect the search', () => {
  const data = catalog([product({ categories: [' Aseo '] }), product({ id: 'p2', name: 'Bebida', categories: ['Bebidas'] })]);
  assert.equal(filterProducts(data.products, new Set(['Aseo', 'Bebidas']), '').length, 2);
  assert.equal(filterProducts(data.products, new Set(['Aseo']), 'bebida').length, 0);
  assert.equal(filterProducts(data.products, new Set(), ' BEBIDA ')[0].id, 'p2');
});

test('novelties exclude future and invalid dates', () => {
  const now = Date.parse('2026-09-28');
  assert.equal(isNewProduct(product({ createdAt: '2026-09-27' }), now), true);
  assert.equal(isNewProduct(product({ createdAt: '2026-10-01' }), now), false);
  assert.equal(isNewProduct(product({ createdAt: '' }), now), false);
});

test('HTML and JSON-LD escape untrusted product content and use the selected business', () => {
  const resolved = resolveCatalogConfig(demo);
  const data = normalizeCatalog({ currency: 'CUP', products: [product({ name: '</script><img src=x onerror=alert(1)>' })] }, resolved);
  const html = renderHead(resolved) + buildSnapshot(data, resolved);
  assert.doesNotMatch(html, /Batikiosco|batikiosko\.github\.io|cmt7ni4vh/);
  assert.match(html, /noindex/);
  assert.match(html, /&lt;\/script&gt;/);
  assert.doesNotMatch(safeJsonLd(data), /<\/script>/);
  assert.ok(html.includes(resolved.texts.faq[0].answer));
});

test('request sends the same company and device and normalizes data', async () => {
  const resolved = resolveCatalogConfig(demo);
  let requested;
  const data = await requestCatalog(resolved, { fetchImpl: async (url, options) => {
    requested = url;
    assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify({ currency: 'CUP', products: [product()] }));
  } });
  assert.equal(requested.searchParams.get('companyId'), resolved.companyId);
  assert.equal(requested.searchParams.get('deviceId'), resolved.deviceId);
  assert.equal(data.products[0].name, 'Producto');
});

test('request explains network, HTTP and malformed JSON failures and can be retried', async () => {
  await assert.rejects(requestCatalog(config, { fetchImpl: async () => { throw new TypeError('fetch failed'); } }), /conectar/);
  await assert.rejects(requestCatalog(config, { fetchImpl: async () => new Response('', { status: 404 }) }), /disponible/);
  await assert.rejects(requestCatalog(config, { fetchImpl: async () => new Response('', { status: 503 }) }), /503/);
  await assert.rejects(requestCatalog(config, { fetchImpl: async () => new Response('<html>bad') }), /JSON/);
  const retried = await requestCatalog(config, { fetchImpl: async () => new Response(JSON.stringify({ currency: 'CUP', products: [] })) });
  assert.equal(retried.products.length, 0);
});

test('timeout includes reading the body and caller cancellation remains distinct', async () => {
  const pending = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  await assert.rejects(requestCatalog(config, { timeoutMs: 10, fetchImpl: pending }), /tardó demasiado/);
  await assert.rejects(requestCatalog(config, { timeoutMs: 10, fetchImpl: async (_url, { signal }) => ({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })),
  }) }), /tardó demasiado/);
  const controller = new AbortController();
  const request = requestCatalog(config, { signal: controller.signal, fetchImpl: pending });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});
