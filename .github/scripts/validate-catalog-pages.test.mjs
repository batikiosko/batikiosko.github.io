import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  readTrustedTarget,
  sha256,
  validateArtifactSha,
  validateGitArtifact,
  verifyRelease,
} from './validate-catalog-pages.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const expectedIdentity = {
  profile: 'batikiosco',
  repository: 'batikiosko/batikiosko.github.io',
  publicUrl: 'https://batikiosko.github.io/',
};

function fixture({
  profile = expectedIdentity.profile,
  repository = expectedIdentity.repository,
  publicUrl = expectedIdentity.publicUrl,
  sw = 'self.addEventListener("fetch", () => {});',
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'catalog-pages-release-'));
  const site = join(root, 'site');
  mkdirSync(join(site, 'assets'), { recursive: true });
  const engineCommit = '1'.repeat(40);
  const configDigest = '2'.repeat(64);
  const base = new URL(publicUrl).pathname;
  const files = new Map([
    ['assets/app.js', `navigator.serviceWorker.register(${JSON.stringify(`${base}sw.js`)});`],
    ['assets/icon.png', 'png'],
    ['index.html', `<link href="${base}manifest.webmanifest" rel="manifest"><script src="${base}assets/app.js" type="module"></script>`],
    ['offline.html', '<p>offline</p>'],
    ['manifest.webmanifest', JSON.stringify({
      display: 'standalone',
      scope: base,
      start_url: base,
      id: base,
      icons: [{ src: `${base}assets/icon.png`, sizes: '192x192', type: 'image/png', purpose: 'any' }],
    })],
    ['sw.js', sw],
    ['catalog-build.json', JSON.stringify({
      publicUrl,
      build: { profile, engineCommit, configDigest },
    })],
    ['pwa-assets.json', '[]'],
    ['robots.txt', 'User-agent: *'],
    ['sitemap.xml', '<urlset></urlset>'],
  ]);
  for (const [path, contents] of files) {
    writeFileSync(join(site, ...path.split('/')), contents);
  }
  const inventory = [...files].map(([path, contents]) => ({
    path,
    sha256: sha256(Buffer.from(contents)),
  }));
  writeFileSync(join(site, 'catalog-release.json'), JSON.stringify({
    schemaVersion: 1,
    profile,
    engineCommit,
    sourceDirty: false,
    configDigest,
    repository,
    publicUrl,
    artifactDigest: sha256(JSON.stringify(inventory)),
    files: inventory,
  }));
  return { root, site };
}

function refreshInventory(site) {
  const marker = join(site, 'catalog-release.json');
  const release = JSON.parse(readFileSync(marker, 'utf8'));
  release.files = release.files.map((file) => ({
    ...file,
    sha256: sha256(readFileSync(join(site, ...file.path.split('/')))),
  }));
  release.artifactDigest = sha256(JSON.stringify(release.files));
  writeFileSync(marker, JSON.stringify(release));
}

test('receiver is manual-only and least-privilege', () => {
  const workflow = readFileSync(join(repositoryRoot, '.github', 'workflows', 'catalog-pages.yml'), 'utf8')
    .replaceAll('\r\n', '\n');
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /repository_dispatch|client_payload|\bpush:|pull_request:|schedule:|workflow_run:/);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow, /contents: write|npm\s+(?:run\s+)?build|--force|backend/i);
  assert.match(workflow, /permissions:\n      pages: write\n      id-token: write/);
  assert.match(workflow, /group: pages\n  cancel-in-progress: false/);
  assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
  assert.doesNotMatch(workflow, /actions\/upload-pages-artifact@/);
});

test('artifact_sha accepts only a full lowercase SHA', () => {
  const valid = 'a'.repeat(40);
  assert.equal(validateArtifactSha(valid), valid);
  for (const invalid of ['a'.repeat(39), 'A'.repeat(40), 'HEAD', 'catalog-dist', 'main', `${valid}^`]) {
    assert.throws(() => validateArtifactSha(invalid));
  }
});

test('trusted target declares Batikiosco profile and exact public URL', () => {
  assert.deepEqual(readTrustedTarget(join(repositoryRoot, 'catalog-target.json')), {
    profile: 'batikiosco',
    publicUrl: 'https://batikiosko.github.io/',
  });
});

test('git trust requires catalog-dist ancestry and exactly one root site tree', () => {
  const { root } = fixture();
  execFileSync('git', ['init', '--initial-branch=catalog-dist', root]);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'tests@example.invalid']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Receiver tests']);
  execFileSync('git', ['-C', root, 'add', 'site']);
  execFileSync('git', ['-C', root, 'commit', '-m', 'valid release']);
  const valid = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/catalog-dist', valid]);
  assert.doesNotThrow(() => validateGitArtifact(root, valid));
  assert.throws(() => validateGitArtifact(root, '0'.repeat(40)), /not in catalog-dist history/);

  writeFileSync(join(root, 'extra.txt'), 'not allowed');
  execFileSync('git', ['-C', root, 'add', 'extra.txt']);
  execFileSync('git', ['-C', root, 'commit', '-m', 'extra root file']);
  const extra = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/catalog-dist', extra]);
  assert.throws(() => validateGitArtifact(root, extra), /root must contain exactly the site tree/);
});

test('release validates inventory, PWA metadata, HTML and checksummed service worker', () => {
  const { site } = fixture();
  const release = verifyRelease(site, expectedIdentity);
  assert.equal(release.profile, 'batikiosco');
  assert.equal(release.publicUrl, 'https://batikiosko.github.io/');
});

test('release rejects alternate identity and public URL', () => {
  assert.throws(() => verifyRelease(fixture({ profile: 'demo' }).site, expectedIdentity));
  assert.throws(() => verifyRelease(fixture({ repository: 'other/example' }).site, expectedIdentity));
  assert.throws(() => verifyRelease(fixture({ publicUrl: 'https://example.com/' }).site, expectedIdentity));
  assert.throws(() => verifyRelease(fixture({ publicUrl: 'https://batikiosko.github.io/catalog/' }).site, expectedIdentity));
});

test('release rejects checksum changes and empty service worker', () => {
  const changed = fixture();
  writeFileSync(join(changed.site, 'sw.js'), 'changed after approval');
  assert.throws(() => verifyRelease(changed.site, expectedIdentity), /Checksum mismatch/);
  assert.throws(() => verifyRelease(fixture({ sw: '' }).site, expectedIdentity), /Service worker is empty/);
});

test('release rejects incoherent manifest and missing critical HTML references', () => {
  const manifest = fixture();
  const manifestPath = join(manifest.site, 'manifest.webmanifest');
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  parsed.display = 'browser';
  writeFileSync(manifestPath, JSON.stringify(parsed));
  refreshInventory(manifest.site);
  assert.throws(() => verifyRelease(manifest.site, expectedIdentity));

  const html = fixture();
  writeFileSync(join(html.site, 'index.html'), '<p>missing PWA links</p>');
  refreshInventory(html.site);
  assert.throws(() => verifyRelease(html.site, expectedIdentity));
});
