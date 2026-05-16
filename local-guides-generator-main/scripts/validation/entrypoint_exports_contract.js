#!/usr/bin/env node

/**
 * entrypoint_exports_contract.js
 *
 * Cheap guardrail: hard-fail if build entrypoints reference helper functions
 * that are not actually exported.
 *
 * Used in two places:
 *   - npm prebuild (fail fast before build scripts crash)
 *   - scripts/validate_core.js (core validation suite)
 */

const fs = require('fs');
const path = require('path');

function readText(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

function stripComments(src) {
  // best-effort comment stripping (enough for our simple token scan)
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/^[ \t]*\/\/.*$/mg, '');
  return src;
}

function extractMemberRefs(src, objectName) {
  const out = new Set();
  const re = new RegExp(String.raw`\b${objectName}\.([A-Za-z_][A-Za-z0-9_]*)\b`, 'g');
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  return [...out].sort();
}

function getModuleExports(relPath) {
  const abs = path.join(process.cwd(), relPath);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const mod = require(abs);
  return mod && typeof mod === 'object' ? Object.keys(mod) : [];
}

function assertExportsUsed({ entrypointRelPath, objectName, helperRelPath, allowlist = [] }) {
  const srcRaw = readText(entrypointRelPath);
  const src = stripComments(srcRaw);
  const refs = extractMemberRefs(src, objectName).filter((n) => !allowlist.includes(n));
  if (refs.length === 0) return;

  const exported = new Set(getModuleExports(helperRelPath));
  const missing = refs.filter((name) => !exported.has(name));

  if (missing.length) {
    console.error(`\nERROR: EntryPoint exports contract failed.`);
    console.error(`  Entry:  ${entrypointRelPath}`);
    console.error(`  Object: ${objectName}`);
    console.error(`  Helper: ${helperRelPath}`);
    console.error(`  Missing exports referenced: ${missing.join(', ')}`);
    console.error(`  Helper exports: ${[...exported].sort().join(', ')}`);
    process.exit(1);
  }
}

function run() {
  // build_city_sites.js references sponsorship helper
  assertExportsUsed({
    entrypointRelPath: 'scripts/build_city_sites.js',
    objectName: 'sponsorship',
    helperRelPath: 'scripts/helpers/sponsorship.js',
  });

  console.log('✅ ENTRYPOINT EXPORTS CONTRACT PASS');
}

module.exports = { run };

if (require.main === module) {
  run();
}
