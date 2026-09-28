import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { loadProfile, catalogPlugin, packageRoot } from './catalog-plugin.mjs';
import { prerender } from './prerender.mjs';

// Entirely fictitious catalog: never calls a real business or writes server data.
const fixture = { companyName: 'Negocio de prueba CES', currency: 'CUP', products: [
  { id: 'usd', name: 'Producto USD', salePrice: '10', priceCurrency: 'USD', categories: [' Prueba '], imageUrl: '/imagen-inexistente.jpg', galleryImages: ['/otra-imagen-inexistente.jpg'] },
  { id: 'simple', name: 'Oferta simple', salePrice: '100', effectivePrice: '90', onOffer: true, offerFixedPrice: '90', categories: ['Prueba'] },
  { id: 'volume', name: 'Oferta por cantidad', salePrice: '100', effectivePrice: '100', onOffer: true, offerFixedPrice: '80', offerMinQuantity: '3', categories: ['Prueba'] },
] };
const requests = [];
const server = createServer((req, res) => {
  requests.push(new URL(req.url, 'http://localhost'));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(fixture));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const env = { VITE_CATALOG_PROFILE: 'demo', VITE_SYNC_SERVER_URL: `http://127.0.0.1:${server.address().port}` };
  const config = loadProfile(env);
  await build({ root: packageRoot, configFile: false, plugins: [catalogPlugin(config), react()], publicDir: false,
    base: new URL(config.publicUrl).pathname, build: { outDir: 'dist-demo', emptyOutDir: false } });
  // Changing environment after compilation must not change the prerender identity.
  const overrideKeys = ['VITE_COMPANY_ID', 'VITE_DEVICE_ID', 'VITE_SYNC_SERVER_URL'];
  const previousEnv = Object.fromEntries(overrideKeys.map((key) => [key, process.env[key]]));
  let result;
  try {
    process.env.VITE_COMPANY_ID = 'wrong-company-after-build';
    process.env.VITE_DEVICE_ID = 'wrong-device-after-build';
    process.env.VITE_SYNC_SERVER_URL = 'https://wrong-server.example';
    result = await prerender('dist-demo');
  } finally {
    for (const key of overrideKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
  assert.equal(result.catalog.products.length, 3);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].pathname, '/public/catalog');
  assert.equal(requests[0].searchParams.get('companyId'), config.companyId);
  assert.equal(requests[0].searchParams.get('deviceId'), config.deviceId);
  assert.match(result.html, /10,00 USD/);
  assert.doesNotMatch(result.html, /10,00 CUP/);
  assert.match(result.html, /Oferta llevando 3 o más: 80,00 CUP c\/u/);
  const directory = resolve(packageRoot, 'dist-demo');
  const metadata = JSON.parse(await readFile(resolve(directory, 'catalog-build.json'), 'utf8'));
  assert.equal(metadata.companyId, config.companyId);
  assert.equal(metadata.deviceId, config.deviceId);
  assert.match(result.html, /--catalog-primary:#1565C0/);
  const entryUrl = result.html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)[1];
  const entry = await readFile(resolve(directory, entryUrl.replace(new URL(config.publicUrl).pathname, '')), 'utf8');
  for (const value of [config.companyId, config.deviceId, config.syncServerUrl]) assert.ok(entry.includes(value), `Frontend must use build value: ${value}`);
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, config.business.name);
  assert.equal(manifest.scope, '/negocio/'); assert.equal(manifest.start_url, '/negocio/');
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith('/negocio/assets/')));
  for (const file of ['index.html', 'offline.html', 'manifest.webmanifest', 'sw.js', 'pwa-assets.json', 'catalog-build.json', 'robots.txt', 'sitemap.xml', ...(await readdir(resolve(directory, 'assets'))).filter((name) => /\.(js|css|svg)$/.test(name)).map((name) => `assets/${name}`)]) {
    assert.doesNotMatch(await readFile(resolve(directory, file), 'utf8'), /batikiosco|batikiosko\.github\.io|cmt7ni4vh0000zxuwpq1drg58|Máximo Gómez|Zulueta|contabilidad-sync-server/i, file);
  }
  assert.ok(Object.values(metadata.assets).every((url) => url.startsWith('/negocio/assets/')));
  assert.doesNotMatch(await readFile(resolve(directory, 'offline.html'), 'utf8'), /Producto USD|Oferta simple|Oferta por cantidad/);
  console.log('[verify:demo] OK: empresa/dispositivo coherentes, monedas y ofertas correctas, ninguna identidad de Batikiosco en HTML/config/bundle, assets con subruta.');
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
