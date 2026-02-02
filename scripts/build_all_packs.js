#!/usr/bin/env node

/**
 * build_all_packs.js
 *
 * Deterministic "build everything" entrypoint.
 *
 * Per pack:
 *   1) PAGE_SET_FILE=<pack> node scripts/prepare_site.js
 *   2) node scripts/build_city_sites.js
 *   3) node scripts/snapshot_lkg.js
 *   4) node scripts/validate_tbs.js
 *   5) node scripts/validate_core.js
 *
 * This overwrites ./dist per pack. That is intentional: the goal is to catch
 * breakage across packs, not to preserve dist artifacts for multiple packs.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function info(msg) {
  console.log(`INFO: ${msg}`);
}

function run(cmd, args, envExtras = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...envExtras },
  });
  if (res.status !== 0) {
    const pretty = [cmd, ...args].join(' ');
    die(`Command failed (${res.status}): ${pretty}`);
  }
}

// Canonical packs to build.
// We keep this explicit (not globbed) to avoid surprising builds.
const PACKS = [
  'examples/trt_v1.json',
  'examples/pi_v1.json',
  'examples/dentistry_v1.json',
  'examples/neuro_v1.json',
  'examples/uscis_medical_v1.json',
];

// Basic sanity: ensure these files exist.
for (const p of PACKS) {
  const abs = path.join(process.cwd(), 'data', 'page_sets', p);
  const fs = require('node:fs');
  if (!fs.existsSync(abs)) {
    die(`Missing pack pageset: data/page_sets/${p}`);
  }
}

info(`Building all packs (${PACKS.length}): ${PACKS.join(', ')}`);

for (const pageSetFile of PACKS) {
  info(`\n=== PACK: ${pageSetFile} ===`);

  // Always prepare for this pack.
  run('node', ['scripts/prepare_site.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });

  // Build + postbuild audits for this pack.
  run('node', ['scripts/build_city_sites.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });

  // Ensure release snapshots/audits are produced.
  run('node', ['scripts/snapshot_lkg.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });

  // TBS audit (non-core) and core validation.
  run('node', ['scripts/validate_tbs.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });

  run('node', ['scripts/validate_core.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });
}

info('\nALL PACKS: BUILD + VALIDATION PASS');
