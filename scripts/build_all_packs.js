#!/usr/bin/env node

/**
 * Build all supported vertical packs in a deterministic sequence.
 *
 * Purpose:
 * - Rebuild each canonical pack one at a time using the same pipeline.
 * - Intentionally overwrite ./dist for each pass so pack-specific breakage is exposed.
 *
 * Inputs:
 * - Explicit PACKS array of page-set files.
 * - Optional environment overrides such as PAGE_SET_FILE and LKG_ENV.
 *
 * Outputs:
 * - Fresh dist/ output for the active pack during each pass.
 * - Generated artifacts such as sitemap files, llms.txt, redirects, and release snapshots.
 *
 * Side effects:
 * - Rewrites data/site.json through scripts/prepare_site.js.
 * - Rewrites dist/.
 * - Calls validation entrypoints for each pack.
 *
 * Use this when:
 * - You need full cross-pack build and validation confidence before release.
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
  'data/page_sets/examples/trt_v1.json',
  'data/page_sets/examples/pi_v1.json',
  'data/page_sets/examples/dentistry_v1.json',
  'data/page_sets/examples/neuro_v1.json',
  'data/page_sets/examples/uscis_medical_v1.json',
];

// Basic sanity: ensure these files exist.
for (const p of PACKS) {
  const abs = path.join(process.cwd(), p);
  const fs = require('node:fs');
  if (!fs.existsSync(abs)) {
    die(`Missing pack pageset: ${p}`);
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

  // Postbuild artifacts required by dist-dependent validators.
  run('node', ['scripts/sitemap_emit.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });
  run('node', ['scripts/llms_emit.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });
  run('node', ['scripts/citation_manifest_emit.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });
  run('node', ['scripts/indexnow_emit.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });
  run('node', ['scripts/distribution_manifest_emit.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });
  run('node', ['scripts/redirects_emit.js'], {
    PAGE_SET_FILE: pageSetFile,
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });

  // Install the Microsoft Clarity tag before anything snapshots dist, so the
  // snapshot matches what actually ships. `npm run build` installs it too; this
  // path bypasses that script, and a pack built without the tag is a pack whose
  // Clarity project silently records nothing.
  run('node', ['scripts/install_clarity.js'], {
    PAGE_SET_FILE: pageSetFile,
    PAGES_OUT_DIR: 'dist',
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
