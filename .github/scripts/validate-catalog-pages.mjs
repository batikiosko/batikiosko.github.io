import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FULL_SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const PROFILE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RELEASE_PATH = /^(?:assets\/[a-zA-Z0-9_.-]+|[a-zA-Z0-9_.-]+)$/;
const REQUIRED_FILES = [
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'sw.js',
  'catalog-build.json',
  'pwa-assets.json',
  'robots.txt',
  'sitemap.xml',
];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function validateArtifactSha(value) {
  if (!FULL_SHA.test(value ?? '')) throw new Error('artifact_sha must be a full lowercase commit SHA.');
  return value;
}

export function readTrustedTarget(file) {
  const target = JSON.parse(readFileSync(file, 'utf8'));
  if (!PROFILE.test(target.profile ?? '')) throw new Error('Invalid trusted catalog profile.');
  if (typeof target.publicUrl !== 'string') throw new Error('Missing trusted catalog publicUrl.');
  const url = new URL(target.publicUrl);
  if (
    url.href !== target.publicUrl ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) throw new Error('Invalid trusted catalog publicUrl.');
  return target;
}

function git(repository, args) {
  return execFileSync('git', ['-C', repository, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function validateGitArtifact(repository, artifactSha, branch = 'origin/catalog-dist') {
  validateArtifactSha(artifactSha);
  try {
    git(repository, ['merge-base', '--is-ancestor', artifactSha, branch]);
  } catch {
    throw new Error('Artifact commit is not in catalog-dist history.');
  }

  const entries = git(repository, ['ls-tree', artifactSha]).trim().split(/\r?\n/).filter(Boolean);
  if (entries.length !== 1 || !/^040000 tree [a-f0-9]{40}\tsite$/.test(entries[0])) {
    throw new Error('Artifact commit root must contain exactly the site tree.');
  }
}

function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
}

export function verifyRelease(directory, identity) {
  const root = realpathSync(directory);
  const read = (path) => {
    if (typeof path !== 'string' || !RELEASE_PATH.test(path)) throw new Error('Invalid release path.');
    const file = resolve(root, path);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Release entry must be a regular file.');
    const local = relative(root, realpathSync(file));
    if (local.startsWith('..') || isAbsolute(local)) throw new Error('Release file outside root.');
    return readFileSync(file);
  };

  const release = JSON.parse(read('catalog-release.json'));
  if (
    release.schemaVersion !== 1 ||
    release.profile !== identity.profile ||
    release.repository !== identity.repository ||
    release.publicUrl !== identity.publicUrl ||
    !FULL_SHA.test(release.engineCommit ?? '') ||
    release.sourceDirty !== false ||
    !SHA256.test(release.configDigest ?? '')
  ) throw new Error('Invalid release identity or provenance.');

  if (
    !Array.isArray(release.files) ||
    new Set(release.files.map((file) => file.path)).size !== release.files.length ||
    release.files.some((file) => !SHA256.test(file.sha256 ?? '')) ||
    sha256(JSON.stringify(release.files)) !== release.artifactDigest
  ) throw new Error('Invalid release inventory.');

  for (const file of release.files) {
    if (sha256(read(file.path)) !== file.sha256) throw new Error(`Checksum mismatch: ${file.path}`);
  }

  const expected = new Set([...release.files.map((file) => file.path), 'catalog-release.json']);
  const actual = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === 'assets') {
      for (const asset of readdirSync(resolve(root, 'assets'))) actual.push(`assets/${asset}`);
    } else {
      actual.push(entry.name);
    }
  }
  if (actual.length !== expected.size || actual.some((file) => !expected.has(file))) {
    throw new Error('Extra or missing files in release.');
  }
  for (const file of REQUIRED_FILES) {
    if (!expected.has(file)) throw new Error(`Required release file missing: ${file}`);
  }

  const config = JSON.parse(read('catalog-build.json'));
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const expectedUrl = new URL(identity.publicUrl);
  const base = expectedUrl.pathname;
  if (
    config.publicUrl !== identity.publicUrl ||
    config.build.profile !== identity.profile ||
    config.build.engineCommit !== release.engineCommit ||
    config.build.configDigest !== release.configDigest ||
    manifest.display !== 'standalone' ||
    manifest.scope !== base ||
    manifest.start_url !== base ||
    manifest.id !== base
  ) throw new Error('Inconsistent release metadata or PWA manifest.');

  if (
    !Array.isArray(manifest.icons) ||
    manifest.icons.length === 0 ||
    !manifest.icons.every((icon) =>
      typeof icon.src === 'string' &&
      icon.src.startsWith(`${base}assets/`) &&
      expected.has(icon.src.slice(base.length)))
  ) throw new Error('Manifest icons are outside the release.');

  const sw = read('sw.js');
  if (sw.length === 0) throw new Error('Service worker is empty.');

  const index = read('index.html').toString('utf8');
  const manifestPath = `${base}manifest.webmanifest`;
  const linksManifest = tags(index, 'link').some((tag) =>
    attribute(tag, 'rel') === 'manifest' && attribute(tag, 'href') === manifestPath);
  if (!linksManifest) throw new Error('index.html does not reference the expected manifest.');

  const moduleScripts = tags(index, 'script')
    .filter((tag) => attribute(tag, 'type') === 'module')
    .map((tag) => attribute(tag, 'src'))
    .filter(Boolean);
  const registersExpectedWorker = moduleScripts.some((src) => {
    if (!src.startsWith(base)) return false;
    const path = src.slice(base.length);
    if (!expected.has(path)) return false;
    const source = read(path).toString('utf8');
    return source.includes('serviceWorker.register') && source.includes('sw.js');
  });
  if (!registersExpectedWorker) throw new Error('Release bundle does not register the expected service worker.');

  return release;
}

async function main() {
  const [artifactRepository, targetFile, artifactSha, repository] = process.argv.slice(2);
  if (!artifactRepository || !targetFile || !repository) throw new Error('Missing validator arguments.');
  const target = readTrustedTarget(targetFile);
  validateGitArtifact(artifactRepository, artifactSha);
  const release = verifyRelease(resolve(artifactRepository, 'site'), {
    profile: target.profile,
    publicUrl: target.publicUrl,
    repository,
  });
  const result = {
    artifactSha,
    profile: release.profile,
    repository: release.repository,
    publicUrl: release.publicUrl,
    engineCommit: release.engineCommit,
    artifactDigest: release.artifactDigest,
    files: release.files.length + 1,
  };
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Artifact commit: ${artifactSha}\nEngine: ${release.engineCommit}\nDigest: ${release.artifactDigest}\nFiles: ${release.files.length + 1}\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Catalog validation failed.');
    process.exitCode = 1;
  });
}
