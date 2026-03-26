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
  try { fs.accessSync(p); return true; } catch { return false; }
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
  // IMPORTANT:
  // - In `prebuild`, data/site.json does NOT exist yet (prepare_site runs after prebuild).
  // - In `validate:all`, you might validate without building.
  // So: if site.json doesn't exist, validate PAGE_SET_FILE env (when present).
  let raw = null;
  if (exists(sitePath)) {
    const site = readJSON(sitePath);
    raw = site.pageSetFile;
  } else {
    raw = process.env.PAGE_SET_FILE || '';
    if (!raw) {
      console.log('ℹ️ PAGESET CONTRACT SKIP — no data/site.json and no PAGE_SET_FILE env (nothing to validate).');
      return;
    }
  }

  const norm = normalizeToPageSetsRel(raw);

  if (!raw) fail('missing pageSetFile (site.pageSetFile or PAGE_SET_FILE env)');
  if (!norm) fail(`site.pageSetFile normalized to empty from: "${raw}"`);

  // hard rules
  if (/^data\//.test(norm)) fail(`site.pageSetFile must NOT start with "data/". Got: "${norm}"`);
  if (/data\/page_sets\/data\/page_sets\//.test(normalizeInputPath(raw))) {
    fail(`site.pageSetFile contains doubled prefix. Raw: "${raw}"`);
  }
  // When site.json exists, raw MUST already be normalized (we enforce stored format).
  // When only env is available, raw can be either already-normalized or include the prefix.
  if (exists(sitePath) && normalizeInputPath(raw) !== norm) {
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
      // allow absolute repo-relative variants like "data/page_sets/<...>" only
      fail(`snapshot pageSet.file mismatch. Expected "data/page_sets/${norm}" but got "${snapFile}"`);
    }
  }

  pass(norm);
}

if (require.main === module) {
  run();
}

module.exports = { run };
