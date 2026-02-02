/* eslint-disable no-console */

// NOTE: CANONICAL VALIDATORS LIVE IN scripts/validation/*
// Legacy folder scripts/validators/ is intentionally removed to prevent confusion.

const fs = require('fs');
const path = require('path');

const buyoutsSchema = require('./validation/buyouts_schema');
const buyoutNextStepsHardfail = require('./validation/buyout_next_steps_hardfail');
const nextStepsCtaContract = require('./validation/next_steps_cta_contract');
const forProvidersInquiry = require('./validation/for_providers_inquiry');
const guidesIndexLinks = require('./validation/guides_index_links');
const footerContract = require('./validation/footer_contract');
const goldenMajorBlocks = require('./validation/golden_major_blocks');
const linkAudit = require('./validation/link_audit');
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
  buyoutNextStepsHardfail.run({ site });
  forProvidersInquiry.run({ site });
  guidesIndexLinks.run({ site });
  packShadowGlobals.run({ site });
  footerContract.run({ site });
  goldenMajorBlocks.run({ site });
  linkAudit.run({ site });
  nextStepsCtaContract.run({ site });

  console.log('CORE VALIDATION PASS');
}

main();
