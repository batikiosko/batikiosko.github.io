import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadProfile, packageRoot } from '../scripts/catalog-plugin.mjs';
import { inspectPng, decodePng } from '../scripts/png-inspect.mjs';
import { createManifest } from '../src/pwa/manifest.mjs';
import { renderHead } from '../src/catalog/html.mjs';

for (const profile of ['batikiosco', 'demo']) {
  const config = loadProfile({ VITE_CATALOG_PROFILE: profile });
  const bytes = (path) => readFileSync(resolve(packageRoot, path));
  test(`${profile}: normal PNGs preserve transparency and retain the full centered logo`, () => {
    for (const icon of config.pwa.icons.filter((icon) => icon.purpose === 'any')) {
      const image = inspectPng(bytes(icon.src)), size = Number(icon.sizes.split('x')[0]);
      assert.equal(image.width, size); assert.equal(image.height, size);
      assert.equal(image.alphaChannel, true);
      assert.ok(image.transparent > size * size * 0.1);
      assert.ok(image.partial > 0, 'anti-aliased alpha is retained');
      assert.ok(image.corners.every((rgba) => rgba[3] === 0), 'no opaque corner/background');
      const [left, top, right, bottom] = image.bounds;
      assert.ok(left > 0 && top > 0 && right < size - 1 && bottom < size - 1, 'no clipping at any edge');
      assert.ok(Math.abs((left + right) / 2 - size / 2) < size * 0.04);
      assert.ok(Math.abs((top + bottom) / 2 - size / 2) < size * 0.04);
      assert.ok(icon.src.includes(`/pwa/${profile}-`));
    }
  });
  test(`${profile}: maskable is opaque, branded and keeps all foreground in the safe circle`, () => {
    const icon = config.pwa.icons.find((icon) => icon.purpose === 'maskable');
    const buffer = bytes(icon.src), image = inspectPng(buffer), decoded = decodePng(buffer);
    const rgb = config.branding.primaryDark.match(/[a-f0-9]{2}/gi).map((hex) => parseInt(hex, 16));
    assert.equal(image.width, 512); assert.equal(image.height, 512);
    assert.equal(image.transparent + image.partial, 0);
    assert.ok(image.corners.every((corner) => JSON.stringify(corner) === JSON.stringify([...rgb, 255])));
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * 4;
      if (rgb.some((value, channel) => decoded.rgba[at + channel] !== value)) {
        assert.ok(Math.hypot(x + 0.5 - 256, y + 0.5 - 256) <= 512 * 0.4, `foreground outside safe zone: ${x},${y}`);
      }
    }
    assert.equal(createManifest(config).icons.find((entry) => entry.src === icon.src).purpose, 'maskable');
  });
  test(`${profile}: Apple gets a separate branded 180 PNG via HTML at root and subpaths`, () => {
    const image = inspectPng(bytes(config.assets.appleTouch));
    const rgb = config.branding.primaryDark.match(/[a-f0-9]{2}/gi).map((hex) => parseInt(hex, 16));
    assert.equal(image.width, 180); assert.equal(image.height, 180);
    assert.equal(image.transparent + image.partial, 0);
    assert.ok(image.corners.every((corner) => JSON.stringify(corner) === JSON.stringify([...rgb, 255])));
    assert.ok(config.assets.appleTouch.includes(`/pwa/${profile}-apple-180.png`));
    for (const base of ['/', '/catalogo/']) {
      const resolved = { ...config, publicUrl: `https://example.test${base}`, assets: { ...config.assets, appleTouch: `${base}assets/${profile}-apple-180-hash.png` } };
      assert.ok(renderHead(resolved).includes(`<link rel="apple-touch-icon" sizes="180x180" href="${base}assets/${profile}-apple-180-hash.png" />`));
      assert.equal(createManifest(resolved).scope, base);
      if (profile === 'demo') assert.doesNotMatch(renderHead(resolved) + JSON.stringify(createManifest(resolved)), /batikiosco|batikiosko/i);
    }
  });
}

test('Batikiosco icon source has real transparency and remains the original asset', () => {
  const config = loadProfile({ VITE_CATALOG_PROFILE: 'batikiosco' });
  assert.equal(config.pwa.iconSource, 'public/icon-512.png');
  const source = inspectPng(readFileSync(resolve(packageRoot, config.pwa.iconSource)));
  assert.equal(source.width, 512); assert.equal(source.height, 512);
  assert.ok(source.transparent > 0);
});
