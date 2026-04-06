#!/usr/bin/env node
/**
 * Run the core validation contract for the active build.
 *
 * Purpose:
 * - Enforce the minimum safe state for page contracts, routing, conversion surfaces,
 *   guide depth, domain correctness, and release integrity.
 *
 * Inputs:
 * - Active site state from data/site.json.
 * - Built artifacts in dist/ unless dist validation is explicitly disabled.
 * - Environment variables such as LKG_VALIDATE_DIST and LKG_ALLOW_MISSING_DIST.
 *
 * Outputs:
 * - Console pass/fail status.
 * - Non-zero exit code on validation failure.
 *
 * Side effects:
 * - Stops release flow when critical contracts fail.
 *
 * Use this when:
 * - Verifying that a build is safe enough to release or package.
 */

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
const forProvidersContract = require('./validation/for_providers_contract');
const guidesIndexLinks = require('./validation/guides_index_links');
const footerContract = require('./validation/footer_contract');
const goldenMajorBlocks = require('./validation/golden_major_blocks');
const linkAudit = require('./validation/link_audit');
const entrypointExports = require("./validation/entrypoint_exports_contract");
const packShadowGlobals = require('./validation/pack_shadow_globals');
const connectionBubbleContract = require('./validation/connection_bubble_contract');
const conversionContract = require('./validation/conversion_contract');
const citationRoutingBundle = require('./validation/citation_routing_bundle');
const publicSourceUrlPolicy = require('./validation/public_source_url_policy');
const pageSetFileContract = require('./validation/pagesetfile_contract');
const sitemapParityContract = require('./validation/sitemap_parity_contract');
const homepageSchemaContract = require('./validation/homepage_schema_contract');
const requestAssistanceProductionGuardrail = require('./validation/request_assistance_production_guardrail');
const executableBitsContract = require('./validation/executable_bits_contract');
const coveragePlanContract = require('./validation/coverage_plan_contract');
const coverageRuntimeSupportContract = require('./validation/coverage_runtime_support_contract');
const coverageRenderingContract = require('./validation/coverage_rendering_contract');
const fanoutWarning = require('./validation/fanout_warning');
const fanoutDistributionContract = require('./validation/fanout_distribution_contract');
const queryCompilerOverridesContract = require('./validation/query_compiler_overrides_contract');
const verticalGuideDepthContract = require('./validation/vertical_guide_depth_contract');
const sponsorPlaceholderContract = require('./validation/sponsor_placeholder_contract');
const siteUrlContract = require('./validation/site_url_contract');

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

  // Training pack must be buildable/publishable without unrelated validation hold-ups.
  // However: connection bubble is a GLOBAL production contract and MUST be enforced.
  const starter = !!(site && isStarterV1(site));
  if (starter) {
    console.log('✅ TRAINING PACK (starter_v1): skipping most core validation, enforcing connection bubble contract.');
  }

  // NOTE: Core validation is strict and intentionally small.
  // Anything “audit-only” belongs in validate_tbs.js.
  if (!starter) {
    buyoutsSchema.run({ site });
  }
  entrypointExports.run();
  publicSourceUrlPolicy.run();
  queryCompilerOverridesContract.run();
  verticalGuideDepthContract.run();
  siteUrlContract.run();

  pageSetFileContract.run();
  requestAssistanceProductionGuardrail.run();
  executableBitsContract.run();
  coveragePlanContract.run();
  require('./validation/coverage_runtime_support_contract');
  if (!starter) {
    buyoutNextStepsHardfail.run({ site });
    stateBuyoutRequiresStateSponsor.run({ site });
    packShadowGlobals.run({ site });
  }

  // Dist-dependent validators:
  // HARD GUARDRAIL (prevents “green locally, red later”):
  //   If dist/ is missing, we FAIL by default.
  //   The ONLY way to skip dist-dependent validators is to explicitly allow it:
  //     LKG_ALLOW_MISSING_DIST=1
  const distDir = path.join(__dirname, '..', 'dist');
  const wantDistValidation = String(process.env.LKG_VALIDATE_DIST || '').trim() === '1';
  const allowMissingDist = String(process.env.LKG_ALLOW_MISSING_DIST || '').trim() === '1';
  const haveDist = fs.existsSync(distDir);

  if (!haveDist) {
    if (allowMissingDist) {
      console.log('ℹ️ dist/ missing: skipping dist-dependent core validators (explicitly allowed via LKG_ALLOW_MISSING_DIST=1).');
      console.log('CORE VALIDATION PASS');
      return;
    }

    console.error('DIST REQUIRED FAIL: dist/ is missing. This is a hard guardrail to prevent false-green validations.');
    console.error('Fix: rm -rf dist && node scripts/build_all_packs.js && LKG_VALIDATE_DIST=1 npm run validate:all');
    console.error('Override (not recommended): set LKG_ALLOW_MISSING_DIST=1 to skip dist-dependent validators.');
    process.exit(1);
  }

  if (wantDistValidation || haveDist) {
    forProvidersInquiry.run({ site });
    forProvidersSalesParity.run({ site });
    guidesIndexLinks.run({ site });
    footerContract.run({ site });
    goldenMajorBlocks.run({ site });
    linkAudit.run({ site });
    nextStepsCtaContract.run({ site });
    connectionBubbleContract.run({ site });
    conversionContract.run({ site });
    // AI citation-routing hardening bundle (Batches 1–6):
    //  - public outbound leak shutdown
    //  - request-assistance tool contract
    //  - answer-first next-steps routing surfaces
    //  - schema hardening for owned routing pages
    //  - consolidated validation entrypoint
    citationRoutingBundle.run({ site });
    sitemapParityContract.run({ site });
    homepageSchemaContract.run({ site });
    sponsorPlaceholderContract.run({ site });
    require('./validation/coverage_rendering_contract');
    fanoutWarning.run({ site });
    fanoutDistributionContract.run({ site });
  } else {
    // Unreachable now because missing dist hard-fails unless explicitly allowed.
    console.log('ℹ️ dist/ missing: skipping dist-dependent core validators.');
  }

  console.log('CORE VALIDATION PASS');
}

main();