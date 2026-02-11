#!/usr/bin/env node
/**
 * PAGE SET FILE CONTRACT (HARD FAIL)
 *
 * Goal: Prevent regressions where pageSetFile is stored or interpreted with the wrong prefix,
 * causing Golden Contract failures like:
 *   data/page_sets/data/page_sets/examples/pi_v1.json
 *
 * Canonical rule:
 * - data/site.json -> site.pageSetFile MUST be repo-relative UNDER data/page_sets/
 *   Example: "examples/pi_v1.json" (NOT "data/page_sets/examples/pi_v1.json")
 *
 * Also validates (when present):
 * - dist/_lkg_snapshot.json -> snapshot.site.pageSetFile MUST match the same normalized value
 *
 * This is intentionally tiny + dependency-free so it can run in CI fast.
 */

const fs = require('fs');
const path = require('path');

function repoRoot() {
  // scripts/validation/... -> repo root is two dirs up
  return path.resolve(__dirname, '..', '..');
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function normalizeInputPath(raw) {
  const s = String(raw || '').trim();
  // normalize slashes + strip leading "./"
  return s.replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeToPageSetsRel(rawPageSetFile) {
  const s0 = normalizeInputPath(rawPageSetFile);
  if (!s0) return '';

  // If caller provided "data/page_sets/..." (or accidentally doubled), strip the prefix(es).
  let s = s0;
  for (let i = 0; i < 5; i++) {
    if (s.startsWith('data/page_sets/')) s = s.slice('data/page_sets/'.length);
    else break;
  }

  // If caller provided absolute-ish repo-root path fragments, strip leading "/".
  s = s.replace(/^\/+/, '');

  return s;
}

function fail(msg) {
  console.error(`❌ PAGESET CONTRACT FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`✅ PAGESET CONTRACT PASS${msg ? ` — ${msg}` : ''}`);
}

function run() {
  const root = repoRoot();

  const sitePath = path.join(root, 'data', 'site.json');
  if (!exists(sitePath)) {
    // validate:all can run without building; that's fine.
    console.log('ℹ️ PAGESET CONTRACT SKIP — data/site.json missing (run build to generate).');
    return;
  }

  const site = readJSON(sitePath);
  const raw = site.pageSetFile;

  const norm = normalizeToPageSetsRel(raw);

  if (!raw) fail('data/site.json missing site.pageSetFile');
  if (!norm) fail(`site.pageSetFile normalized to empty from: "${raw}"`);

  // hard rules
  if (/^data\//.test(norm)) fail(`site.pageSetFile must NOT start with "data/". Got: "${norm}"`);
  if (/data\/page_sets\/data\/page_sets\//.test(normalizeInputPath(raw))) {
    fail(`site.pageSetFile contains doubled prefix. Raw: "${raw}"`);
  }
  if (normalizeInputPath(raw) !== norm) {
    // If raw differs, it means somebody wrote the wrong format. Enforce write-format.
    fail(`site.pageSetFile must be stored normalized. Expected "${norm}" but found "${raw}"`);
  }

  const pageSetAbs = path.join(root, 'data', 'page_sets', norm);
  if (!exists(pageSetAbs)) {
    fail(`pageSetFile does not exist: data/page_sets/${norm}`);
  }

  // snapshot (optional)
  const snapPath = path.join(root, 'dist', '_lkg_snapshot.json');
  if (exists(snapPath)) {
    const snap = readJSON(snapPath);
    const snapPS = snap?.site?.pageSetFile;
    if (!snapPS) fail('dist/_lkg_snapshot.json missing site.pageSetFile');
    if (snapPS !== norm) {
      fail(`snapshot site.pageSetFile mismatch. Expected "${norm}" but got "${snapPS}"`);
    }
    const snapFile = snap?.pageSet?.file;
    if (snapFile && snapFile !== `data/page_sets/${norm}`) {
      fail(`snapshot pageSet.file mismatch. Expected "data/page_sets/${norm}" but got "${snapFile}"`);
    }
  }

  pass(norm);
}

if (require.main === module) {
  run();
}

module.exports = { run };
