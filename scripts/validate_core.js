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
  const pageSetFileContract = require('./validation/pagesetfile_contract');
  pageSetFileContract.run();
  buyoutNextStepsHardfail.run({ site });
  stateBuyoutRequiresStateSponsor.run({ site });
  packShadowGlobals.run({ site });

  // Dist-dependent validators:
  // - In CI / source-only validation, dist/ often doesn't exist.
  // - We should not hard-fail the repo for missing dist unless we explicitly asked to validate dist.
  const distDir = path.join(__dirname, '..', 'dist');
  const wantDistValidation = String(process.env.LKG_VALIDATE_DIST || '').trim() === '1';
  const haveDist = fs.existsSync(distDir);

  if (wantDistValidation || haveDist) {
    forProvidersInquiry.run({ site });
    forProvidersSalesParity.run({ site });
    guidesIndexLinks.run({ site });
    footerContract.run({ site });
    goldenMajorBlocks.run({ site });
    linkAudit.run({ site });
    nextStepsCtaContract.run({ site });
  } else {
    console.log('ℹ️ dist/ missing: skipping dist-dependent core validators. Set LKG_VALIDATE_DIST=1 to enforce.');
  }

  console.log('CORE VALIDATION PASS');
}

main();
