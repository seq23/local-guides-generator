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

  // Seat the recommendation_summary block on the rendered pages. It has to run
  // here - after the renderer, before install_clarity.js - for the same reason
  // install_clarity.js has to run before lastmod_apply.js: every step that
  // mutates a rendered page must run before anything hashes it, and both
  // pipelines must hash at the same point. `npm run build` runs this in the same
  // position within its `build` script.
  run('node', ['scripts/retrofit_recommendation_summary.js', '--apply'], {
    PAGE_SET_FILE: pageSetFile,
    PAGES_OUT_DIR: 'dist',
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });

  // Install the Microsoft Clarity tag before anything snapshots dist, so the
  // snapshot matches what actually ships. `npm run build` installs it too; this
  // path bypasses that script, and a pack built without the tag is a pack whose
  // Clarity project silently records nothing.
  //
  // It has to run here rather than after the emitters: lastmod_apply.js hashes
  // the rendered page to decide whether its content changed, and `npm run build`
  // installs the tag as part of `build`, before `postbuild` hashes anything. If
  // the two pipelines hashed the page at different points, every page would look
  // changed whenever the other pipeline had produced the previous ledger entry.
  run('node', ['scripts/install_clarity.js'], {
    PAGE_SET_FILE: pageSetFile,
    PAGES_OUT_DIR: 'dist',
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });

  // Freshness dates next. build_city_sites.js stamps the build timestamp into
  // every page's citation_modified_date, and sitemap_emit.js reads that field
  // for <lastmod> - so without this step every URL in every sitemap claims to
  // have been refreshed on the build day. This replaces those stamps with the
  // date each page's content actually last changed, before anything reads them.
  run('node', ['scripts/lastmod_apply.js'], {
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

  // Apply the robots policy LAST, matching `npm run build`, which ends with it.
  //
  // It was missing here entirely. `npm run build` runs apply_robots_policy.js;
  // this file -- the path used by build:dist, distribution:prepare and CI, i.e.
  // the one that actually deploys -- never did. So ~200 template-fallback city
  // pages shipped `index,follow` while build_city_sites.js:858 commented they
  // were "no longer indexable", and the 52 dentistry hubs noindexed on
  // 2026-08-27 would have deployed indexable. A policy only the unused build
  // path enforces is not a policy.
  //
  // Ordering note: running it before sitemap_emit is the intuitive order but
  // breaks the coverage contract, which requires every promoted city in the
  // sitemap -- and some promoted cities are still template-fallback. That
  // conflict is real and pre-existing; it is recorded, not resolved here.
  run('node', ['scripts/apply_robots_policy.js'], {
    PAGE_SET_FILE: pageSetFile,
    PAGES_OUT_DIR: 'dist',
    LKG_ENV: process.env.LKG_ENV || 'baseline',
  });
}

info('\nALL PACKS: BUILD + VALIDATION PASS');
