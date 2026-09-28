import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { escapeHtml } from '../src/catalog/html.mjs';

export async function finalizePwa(directory, config, shellHtml) {
  const base = new URL(config.publicUrl).pathname;
  // This HTML has no product snapshot, even before React starts offline.
  const offline = shellHtml.replace('<div id="root"></div>', `<div id="root"><main><h1>${escapeHtml(config.business.name)}</h1><p>Sin conexión. Conectate a internet para consultar productos y precios actuales.</p></main></div>`);
  await writeFile(resolve(directory, 'offline.html'), offline);
  // Rollup's inventory belongs to this build, excluding leftover output files.
  const assets = JSON.parse(await readFile(resolve(directory, 'pwa-assets.json'), 'utf8'));
  const precache = ['offline.html', 'manifest.webmanifest', ...assets].sort();
  const template = await readFile(new URL('../src/pwa/service-worker.js', import.meta.url), 'utf8');
  const hash = createHash('sha256').update(template).update(JSON.stringify(config));
  hash.update(await readFile(resolve(directory, 'index.html')));
  for (const file of precache) hash.update(file).update(await readFile(resolve(directory, file)));
  const version = hash.digest('hex').slice(0, 16);
  const namespace = createHash('sha256').update(base).digest('hex').slice(0, 16);
  const settings = { base, prefix: `ces-catalog-${namespace}-`, version, urls: precache.map((file) => base + file) };
  await writeFile(resolve(directory, 'sw.js'), template.replace('__CES_PWA_SETTINGS__', JSON.stringify(settings)));
  return settings;
}
