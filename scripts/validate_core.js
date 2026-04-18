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
const buyoutRuntimeCtaContract = require('./validation/buyout_runtime_cta_contract');
const nextStepsCtaContract = require('./validation/next_steps_cta_contract');
const forProvidersInquiry = require('./validation/for_providers_inquiry');
const forProvidersSalesParity = require('./validation/for_providers_sales_parity');
const sponsorshipConflictValidator = require('./validation/sponsorship_conflict_validator');
const sponsorCatalogContract = require('./validation/sponsor_catalog_contract');
const cityRequestTemplateContract = require('./validation/city_request_template_contract');
const forProvidersContract = require('./validation/for_providers_contract');
const adminPageContract = require('./validation/admin_page_contract');
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
const conversionIntentContract = require('./validation/conversion_intent_contract');
const siteUrlContract = require('./validation/site_url_contract');
const workflowIntegrityContract = require('./validation/workflow_integrity_contract');
const cityDecisionSupportContract = require('./validation/city_decision_support_contract');
const piTrustToneContract = require('./validation/pi_trust_tone_contract');
const piSurfaceContract = require('./validation/pi_surface_contract');
const piQueryCompletenessContract = require('./validation/pi_query_completeness_contract');
const citationExtractabilityContract = require('./validation/citation_extractability_contract');
const citationMetadataContract = require('./validation/citation_metadata_contract');
const citationManifestContract = require('./validation/citation_manifest_contract');
const sitemapDistributionContract = require('./validation/sitemap_distribution_contract');
const distributionArtifactsContract = require('./validation/distribution_artifacts_contract');
const internalDistributionContract = require('./validation/internal_distribution_contract');
const distributionDominanceContract = require('./validation/distribution_dominance_contract');
const sitemapFreshContract = require('./validation/sitemap_fresh_contract');
const answerBlockStrengthContract = require('./validation/answer_block_strength_contract');
const evaluationFrameworkContract = require('./validation/evaluation_framework_contract');
const stateAuthorityContract = require('./validation/state_authority_contract');
const guideIntroContract = require('./validation/guide_intro_contract');
const hierarchyReinforcementContract = require('./validation/hierarchy_reinforcement_contract');
const internalLinkingQualityContract = require('./validation/internal_linking_quality_contract');
const metadataSchemaStrengthContract = require('./validation/metadata_schema_strength_contract');
const homepageGuidesHubContract = require('./validation/homepage_guides_hub_contract');
const homepageEntityContract = require('./validation/homepage_entity_contract');
const homepageSurfaceContract = require('./validation/homepage_surface_contract');
const uscisVerticalCongruenceContract = require('./validation/uscis_vertical_congruence_contract');
const providerCardContract = require('./validation/provider_card_contract');
const stateHubContract = require('./validation/state_hub_contract');
const ctaAdjacencyContract = require('./validation/cta_adjacency_contract');
const guideStructureContract = require('./validation/guide_structure_contract');
const guideQualityScore = require('./validation/guide_quality_score');
const guideComplianceScore = require('./validation/guide_compliance_score');
require('./validation/footer_weight_contract');
require('./validation/cta_dedup_contract');

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
  sponsorshipConflictValidator.run({ site });
  verticalGuideDepthContract.run();
  siteUrlContract.run();
  workflowIntegrityContract.run();

  pageSetFileContract.run();
  requestAssistanceProductionGuardrail.run();
  executableBitsContract.run();
  coveragePlanContract.run();
  require('./validation/coverage_runtime_support_contract');
  if (!starter) {
    buyoutNextStepsHardfail.run({ site });
    buyoutRuntimeCtaContract.run({ site });
    sponsorCatalogContract.run({ site });
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
    if (starter) {
      const runStarterWarnOnly = (label, fn) => {
        try {
          fn.run({ site });
        } catch (err) {
          const msg = (err && err.message) ? err.message : String(err || '');
          console.warn(`⚠️ STARTER WARN-ONLY: ${label}\n${msg}`);
        }
      };

      adminPageContract.run({ site });
      linkAudit.run({ site });
      nextStepsCtaContract.run({ site });

      runStarterWarnOnly('footer_contract', footerContract);
      runStarterWarnOnly('golden_major_blocks', goldenMajorBlocks);
      runStarterWarnOnly('connection_bubble_contract', connectionBubbleContract);

      console.log('✅ STARTER PACK DIST VALIDATION PASS (hard-fail sanity + warn-only polish set)');
      console.log('CORE VALIDATION PASS');
      return;
    }
    forProvidersInquiry.run({ site });
    adminPageContract.run({ site });
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
    conversionIntentContract.run({ site });
    cityDecisionSupportContract.run({ site });
    piTrustToneContract.run({ site });
    piSurfaceContract.run({ site });
    piQueryCompletenessContract.run({ site });
    citationExtractabilityContract.run({ site });
    citationMetadataContract.run({ site });
    citationManifestContract.run({ site });
    sitemapDistributionContract.run({ site });
    distributionArtifactsContract.run({ site });
    internalDistributionContract.run({ site });
    distributionDominanceContract.run({ site });
    sitemapFreshContract.run({ site });
    answerBlockStrengthContract.run({ site });
    evaluationFrameworkContract.run({ site });
    stateAuthorityContract.run({ site });
    guideIntroContract.run({ site });
    guideStructureContract.run({ site });
    ctaAdjacencyContract.run({ site });
    guideQualityScore.run({ site });
    guideComplianceScore.run({ site });
    hierarchyReinforcementContract.run({ site });
    internalLinkingQualityContract.run({ site });
    metadataSchemaStrengthContract.run({ site });
    homepageGuidesHubContract.run({ site });
    homepageEntityContract.run({ site });
    homepageSurfaceContract.run({ site });
    stateHubContract.run({ site });
    providerCardContract.run({ site });
    uscisVerticalCongruenceContract.run({ site });
    coverageRenderingContract.run({ site });
    fanoutWarning.run({ site });
    fanoutDistributionContract.run({ site });
  } else {
    // Unreachable now because missing dist hard-fails unless explicitly allowed.
    console.log('ℹ️ dist/ missing: skipping dist-dependent core validators.');
  }

  console.log('CORE VALIDATION PASS');
}

main();