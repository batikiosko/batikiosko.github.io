import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { openBrowser } from './browser-session.mjs';
import { loadProfile, packageRoot } from './catalog-plugin.mjs';

// Deterministic rasterization/resizing of an existing logo, never generated art.
const [profile] = process.argv.slice(2);
if (process.argv.length !== 3 || !/^[a-z0-9-]+$/.test(profile || '')) throw new Error('Uso: node scripts/generate-pwa-icons.mjs <perfil>');
const config = loadProfile({ VITE_CATALOG_PROFILE: profile });
const sourcePath = config.pwa.iconSource;
const background = config.branding.primaryDark;
const source = resolve(packageRoot, sourcePath);
const local = relative(packageRoot, source);
if (local.startsWith('..') || isAbsolute(local)) throw new Error('El logo debe estar dentro de catalog-web.');
const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg' }[extname(source)];
if (!mime) throw new Error('Logo PNG, SVG o JPEG requerido.');
const data = `data:${mime};base64,${(await readFile(source)).toString('base64')}`;
const directory = resolve(packageRoot, 'public/pwa');
await mkdir(directory, { recursive: true });
const browser = await openBrowser('icons');
try {
  const variants = [
    { size: 192, suffix: '192', coverage: 0.9, opaque: false },
    { size: 512, suffix: '512', coverage: 0.9, opaque: false },
    { size: 512, suffix: 'maskable-512', coverage: 0.55, opaque: true },
    { size: 180, suffix: 'apple-180', coverage: 0.8, opaque: true },
  ];
  for (const { size, suffix, coverage, opaque } of variants) {
    const png = await browser.evaluate(`(async () => {
      const image = new Image(); image.src = ${JSON.stringify(data)}; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = ${size};
      const ctx = canvas.getContext('2d');
      // Normal icons retain source alpha. Platforms requiring an opaque tile
      // receive their own variant, using the profile's existing brand color.
      if (${opaque}) { ctx.fillStyle = ${JSON.stringify(background)}; ctx.fillRect(0, 0, ${size}, ${size}); }
      // A centered 55% square fits entirely within the maskable safe circle.
      const scale = ${size} * ${coverage} / Math.max(image.width, image.height);
      const width = image.width * scale, height = image.height * scale;
      ctx.drawImage(image, (${size} - width) / 2, (${size} - height) / 2, width, height);
      return canvas.toDataURL('image/png').split(',')[1];
    })()`);
    await writeFile(resolve(directory, `${profile}-${suffix}.png`), Buffer.from(png, 'base64'));
  }
} finally { await browser.close(); }
console.log(`[icons] ${profile}: PNG 192/512 con alpha, maskable 512 y Apple 180 opacos (${background}), derivados de ${sourcePath}.`);
