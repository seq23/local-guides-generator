/* eslint-disable no-console */

// NOTE: CANONICAL VALIDATORS LIVE IN scripts/validation/*
// Legacy folder scripts/validators/ is intentionally removed to prevent confusion.

const fs = require('fs');
const path = require('path');

const buyoutsSchema = require('./validation/buyouts_schema');
const stateBuyoutRequiresStateSponsor = require('./validation/state_buyout_requires_state_sponsor');
const buyoutNextStepsHardfail = require('./validation/buyout_next_steps_hardfail');
const nextStepsCtaContract = require('./validation/next_steps_cta_contract');
const forProvidersInquiry = require('./validation/for_providers_inquiry');
const forProvidersSalesParity = require('./validation/for_providers_sales_parity');
const guidesIndexLinks = require('./validation/guides_index_links');
const footerContract = require('./validation/footer_contract');
const goldenMajorBlocks = require('./validation/golden_major_blocks');
const linkAudit = require('./validation/link_audit');
const entrypointExports = require("./validation/entrypoint_exports_contract");
const packShadowGlobals = require('./validation/pack_shadow_globals');

function readSiteJsonOrNull() {
  const p = path.join(__dirname, '..', 'data', 'site.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function isStarterV1(site) {
  const ps = String(site?.pageSetFile || '');
  return /(^|\/)starter_v1\.json$/i.test(ps);
}

function main() {
  const site = readSiteJsonOrNull();

  // Training pack must be buildable/publishable without any validation hold-ups.
  if (site && isStarterV1(site)) {
    console.log('✅ TRAINING PACK (starter_v1): skipping core validation (non-blocking).');
    process.exit(0);
  }

  // NOTE: Core validation is strict and intentionally small.
  // Anything “audit-only” belongs in validate_tbs.js.
  buyoutsSchema.run({ site });
  entrypointExports.run();
  buyoutNextStepsHardfail.run({ site });
  stateBuyoutRequiresStateSponsor.run({ site });
  packShadowGlobals.run({ site });

  // Dist-dependent validators (HARD GUARDRAIL):
  // We do NOT allow the "dist missing → skip dist-dependent validators → green locally → surprise red later" trap.
  // Rule:
  // - If dist/ is missing, validation FAILS by default.
  // - To intentionally run source-only validators, set LKG_ALLOW_DIST_SKIP=1.
  // - If LKG_VALIDATE_DIST=1 is set, dist/ MUST exist (hard fail otherwise).
  const distDir = path.join(__dirname, '..', 'dist');
  const wantDistValidation = String(process.env.LKG_VALIDATE_DIST || '').trim() === '1';
  const allowDistSkip = String(process.env.LKG_ALLOW_DIST_SKIP || '').trim() === '1';
  const haveDist = fs.existsSync(distDir);

  if (!haveDist) {
    if (wantDistValidation) {
      console.error('DIST REQUIRED: dist/ is missing but LKG_VALIDATE_DIST=1 was set.');
      console.error('Fix: build dist first (e.g., `node scripts/build_all_packs.js` or `node scripts/build_city_sites.js`) then rerun validation.');
      process.exit(1);
    }

    if (!allowDistSkip) {
      console.error('DIST REQUIRED: dist/ is missing.');
      console.error('This repo forbids the "dist missing → skip validators → green → surprise red" failure mode.');
      console.error('Fix: build dist first (recommended), then rerun validation.');
      console.error('If you intentionally want SOURCE-ONLY validation, rerun with: LKG_ALLOW_DIST_SKIP=1 npm run validate:all');
      process.exit(1);
    }

    console.log('ℹ️ dist/ missing: SOURCE-ONLY validation allowed (LKG_ALLOW_DIST_SKIP=1). Dist-dependent validators skipped.');
  }

  if (haveDist) {
    forProvidersInquiry.run({ site });
    forProvidersSalesParity.run({ site });
    guidesIndexLinks.run({ site });
    footerContract.run({ site });
    goldenMajorBlocks.run({ site });
    linkAudit.run({ site });
    nextStepsCtaContract.run({ site });
  } else {
    // unreachable: we either hard-fail above (default) or explicitly allowed source-only validation
  }

  console.log('CORE VALIDATION PASS');
}

main();
