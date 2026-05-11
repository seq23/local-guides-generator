const fs = require('fs');
const path = require('path');
const { resolveIndexNowKey } = require('./lib/resolve_indexnow_key');

const ROOT = process.cwd();
const BUILD_BATCH = path.join(ROOT, '.build', 'indexnow-batch.txt');
const BUILD_PRIORITY = path.join(ROOT, '.build', 'indexnow-priority.txt');
const DIST_BATCH = path.join(ROOT, 'dist', 'indexnow-batch.txt');
const DIST_PRIORITY = path.join(ROOT, 'dist', 'indexnow-priority.txt');

function lines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function fail(msg) {
  throw new Error(msg);
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const resolved = resolveIndexNowKey();
const keyPath = path.join(ROOT, resolved.keyFile);

if (!fs.existsSync(keyPath)) fail(`IndexNow key file missing: ${resolved.keyFile}`);

const keyBody = fs.readFileSync(keyPath, 'utf8').trim();
if (keyBody !== resolved.key) fail(`IndexNow key file content mismatch: ${resolved.keyFile}`);

const buildBatch = lines(readIfExists(BUILD_BATCH)).filter((l) => /^https?:\/\//i.test(l));
const buildPriority = lines(readIfExists(BUILD_PRIORITY)).filter((l) => /^https?:\/\//i.test(l));
const distBatch = lines(readIfExists(DIST_BATCH)).filter((l) => /^https?:\/\//i.test(l));
const distPriority = lines(readIfExists(DIST_PRIORITY)).filter((l) => /^https?:\/\//i.test(l));

const batch = distBatch.length ? distBatch : buildBatch;
const priority = distPriority.length ? distPriority : buildPriority;

if (!priority.length) fail('No usable indexnow-priority.txt found in .build/ or dist/');
if (!batch.length) fail('No usable indexnow-batch.txt found in .build/ or dist/');
if (priority.length > 100) fail(`indexnow-priority.txt too large (${priority.length})`);

const hosts = new Set(priority.concat(batch).map((u) => {
  try { return new URL(u).host; } catch { return null; }
}).filter(Boolean));

if (hosts.size < 1) fail('IndexNow files do not contain valid URLs');

console.log(`validate_indexnow: OK (key=${resolved.keyFile} priority=${priority.length} batch=${batch.length} hosts=${Array.from(hosts).join(',')})`);
