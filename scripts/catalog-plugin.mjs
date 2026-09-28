import { readFileSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveCatalogConfig } from '../src/catalog/config.mjs';
import { renderHead, renderRobots, renderSitemap } from '../src/catalog/html.mjs';
import { createManifest } from '../src/pwa/manifest.mjs';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));

export function loadProfile(env) {
  const profile = env.VITE_CATALOG_PROFILE || 'batikiosco';
  if (!/^[a-z0-9-]+$/.test(profile)) throw new Error('VITE_CATALOG_PROFILE inválido.');
  return resolveCatalogConfig(JSON.parse(readFileSync(resolve(packageRoot, 'config/businesses', `${profile}.json`), 'utf8')), env);
}

export function catalogPlugin(config) {
  let resolved, context;
  const refs = new Map();
  const files = [...Object.entries(config.assets).map(([key, path]) => [`assets.${key}`, path]), ...Object.entries(config.categoryImages).map(([key, path]) => [`categoryImages.${key}`, path]), ...config.pwa.icons.map((icon, i) => [`pwa.${i}`, icon.src])];
  const absolute = (path) => {
    const file = resolve(packageRoot, path);
    const local = relative(packageRoot, file);
    if (isAbsolute(path) || local.startsWith('..') || isAbsolute(local)) throw new Error(`Asset fuera de catalog-web: ${path}`);
    return file;
  };
  const assetUrl = (key, path) => resolved.command === 'build' ? `${resolved.base}${context.getFileName(refs.get(key))}` : `${resolved.base}${path}`;
  const resolvedConfig = () => ({ ...config,
    assets: Object.fromEntries(Object.entries(config.assets).map(([key, path]) => [key, assetUrl(`assets.${key}`, path)])),
    categoryImages: Object.fromEntries(Object.entries(config.categoryImages).map(([key, path]) => [key, assetUrl(`categoryImages.${key}`, path)])),
    pwa: { ...config.pwa, icons: config.pwa.icons.map((icon, i) => ({ ...icon, src: assetUrl(`pwa.${i}`, icon.src) })) },
  });
  return {
    name: 'ces-catalog-config',
    configResolved(value) { resolved = value; },
    buildStart() {
      context = this;
      const emitted = new Map();
      for (const [key, path] of files) {
        this.addWatchFile(absolute(path));
        if (resolved.command === 'build') {
          const source = readFileSync(absolute(path));
          if (key.startsWith('pwa.') || key === 'assets.appleTouch') {
            const size = key === 'assets.appleTouch' ? 180 : Number(config.pwa.icons[Number(key.slice(4))].sizes.split('x')[0]);
            if (source.length < 24 || source.toString('hex', 0, 8) !== '89504e470d0a1a0a' || source.readUInt32BE(16) !== size || source.readUInt32BE(20) !== size) throw new Error(`Dimensiones PNG incorrectas: ${path}`);
          }
          const extension = extname(path);
          const name = basename(path, extension);
          const hash = createHash('sha256').update(source).digest('hex').slice(0, 10);
          const fileName = `assets/${name}-${hash}${extension}`;
          if (!emitted.has(fileName)) emitted.set(fileName, this.emitFile({ type: 'asset', fileName, source }));
          refs.set(key, emitted.get(fileName));
        }
      }
    },
    resolveId(id) { if (id === 'virtual:catalog-config') return '\0virtual:catalog-config'; },
    load(id) { if (id === '\0virtual:catalog-config') return `export default ${JSON.stringify(resolvedConfig())};`; },
    transformIndexHtml: {
      order: 'pre',
      handler(html) { return html.replace('lang="es"', `lang="${config.seo.language}"`).replace('<!-- catalog:head -->', renderHead(resolvedConfig())); },
    },
    generateBundle(_options, bundle) {
      const assetFiles = [...new Set([...Object.keys(bundle).filter((file) => file.startsWith('assets/')), ...refs.values()].map((value) => typeof value === 'string' && value.startsWith('assets/') ? value : this.getFileName(value)))];
      this.emitFile({ type: 'asset', fileName: 'pwa-assets.json', source: JSON.stringify(assetFiles) });
      for (const [fileName, source] of [['catalog-build.json', JSON.stringify(resolvedConfig(), null, 2)], ['manifest.webmanifest', JSON.stringify(createManifest(resolvedConfig()), null, 2)], ['robots.txt', renderRobots(config)], ['sitemap.xml', renderSitemap(config)]]) this.emitFile({ type: 'asset', fileName, source });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path === `${resolved.base}manifest.webmanifest`) {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(createManifest(resolvedConfig())));
          return;
        }
        if (path === `${resolved.base}robots.txt` || path === `${resolved.base}sitemap.xml`) {
          res.setHeader('Content-Type', path.endsWith('.xml') ? 'application/xml' : 'text/plain');
          res.end(path.endsWith('.xml') ? renderSitemap(config) : renderRobots(config));
        } else next();
      });
    },
  };
}
