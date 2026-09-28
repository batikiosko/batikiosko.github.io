import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageRoot } from './catalog-plugin.mjs';
import { requestCatalog } from '../src/catalog/request.mjs';
import { buildSnapshot } from '../src/catalog/html.mjs';
import { finalizePwa } from './pwa-build.mjs';

export async function prerender(outDir = 'dist') {
  const directory = resolve(packageRoot, outDir);
  const local = relative(packageRoot, directory);
  if (!local || local.startsWith('..') || isAbsolute(local)) throw new Error('El destino del prerender debe estar dentro de catalog-web.');
  // Read the exact configuration emitted by Vite. Never resolve environment a second time.
  const config = JSON.parse(await readFile(resolve(directory, 'catalog-build.json'), 'utf8'));
  const index = resolve(directory, 'index.html');
  const html = await readFile(index, 'utf8');
  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) throw new Error('El HTML no tiene el marcador esperado. Volvé a compilar antes de prerenderizar.');
  let catalog = null;
  try {
    catalog = await requestCatalog(config);
  } catch (error) {
    console.warn(`[prerender] ${error.message} Se publica la información del perfil sin productos.`);
  }
  const next = html.replace(marker, `<div id="root">${buildSnapshot(catalog, config)}</div>`);
  await writeFile(index, next, 'utf8');
  await finalizePwa(directory, config, html);
  console.log(`[prerender] ${config.business.name}: ${catalog?.products.length ?? 0} productos; companyId=${config.companyId}; deviceId=${config.deviceId ?? '(automático)'}.`);
  return { config, catalog, html: next };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prerender(process.argv[2]);
