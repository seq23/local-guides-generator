#!/usr/bin/env node
/**
 * PAGE SET FILE CONTRACT (HARD FAIL)
 *
 * Goal: Prevent regressions where pageSetFile is stored or interpreted with the wrong prefix,
 * causing Golden Contract failures like:
 *   data/page_sets/data/page_sets/examples/pi_v1.json
 *
 * Canonical rule:
 * - data/site.json -> site.pageSetFile MUST be a canonical repo-relative path UNDER data/page_sets/
 *   Example: "data/page_sets/examples/pi_v1.json"
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

function normalizeToCanonicalPageSetPath(rawPageSetFile) {
  const s0 = normalizeInputPath(rawPageSetFile);
  if (!s0) return '';

  const needle = 'data/page_sets/';
  const idx = s0.indexOf(needle);
  if (idx === -1) return '';

  const rel = s0.slice(idx + needle.length).replace(/^\/+/, '');
  if (!rel) return '';
  return `${needle}${rel}`;
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

  const norm = normalizeToCanonicalPageSetPath(raw);

  if (!raw) fail('missing pageSetFile (site.pageSetFile or PAGE_SET_FILE env)');
  if (!norm) fail(`pageSetFile must be canonical under data/page_sets/. Got: "${raw}"`);

  // hard rules
  if (/data\/page_sets\/data\/page_sets\//.test(normalizeInputPath(raw))) {
    fail(`site.pageSetFile contains doubled prefix. Raw: "${raw}"`);
  }
  if (normalizeInputPath(raw) !== norm) {
    fail(`pageSetFile must use the canonical repo-relative form. Expected "${norm}" but found "${raw}"`);
  }

  const pageSetAbs = path.join(root, norm);
  if (!exists(pageSetAbs)) {
    fail(`pageSetFile does not exist: ${norm}`);
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
    if (snapFile && snapFile !== norm) {
      // snapshot must store the same canonical repo-relative path
      fail(`snapshot pageSet.file mismatch. Expected "${norm}" but got "${snapFile}"`);
    }
  }

  pass(norm);
}

if (require.main === module) {
  run();
}

module.exports = { run };
