#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const reportsDir = path.join(root, 'reports');
const docsReleaseDir = path.join(root, 'docs', 'releases');
fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(docsReleaseDir, { recursive: true });

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function writeJson(rel, data) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + '\n');
}
function inferVertical(siteUrl, pageSetFile) {
  const hay = `${siteUrl} ${pageSetFile}`.toLowerCase();
  if (hay.includes('accident') || hay.includes('/pi_')) return 'pi';
  if (hay.includes('dentistry')) return 'dentistry';
  if (hay.includes('neuro')) return 'neuro';
  if (hay.includes('uscis')) return 'uscis_medical';
  if (hay.includes('hormones') || hay.includes('trt') || hay.includes('hair')) return 'trt';
  return 'unknown';
}
function distRouteExists(route) {
  const cleaned = route.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '');
  const rel = cleaned === '' ? 'dist/index.html' : path.join('dist', cleaned.replace(/^\//, ''), 'index.html');
  return exists(rel);
}
function uniq(arr) {
  return [...new Set(arr)];
}

const site = readJson('data/site.json');
const activeVertical = inferVertical(site.siteUrl || '', site.pageSetFile || '');
const phase6Summary = readJson('reports/phase6_pdf_recommendations.summary.json');
const phase6Batches = readJson('reports/phase6_recommendation_batches.json');
const phase6LayerPlan = readJson('reports/phase6_layer_plan.json');
const guideRegistry = readJson('data/contracts/guide_enhancement_registry.json');
const prioritySet = readJson('data/contracts/phase45_multi_vertical_city_priority_set.json');

const distRoutes = fs.existsSync(path.join(root, 'dist'))
  ? fs.readdirSync(path.join(root, 'dist')).length
  : 0;

const cityFiles = [];
const cityRoot = path.join(root, 'data', 'city_content');
if (fs.existsSync(cityRoot)) {
  for (const vertical of fs.readdirSync(cityRoot)) {
    const dir = path.join(cityRoot, vertical);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.json')) cityFiles.push({ vertical, slug: file.replace(/\.json$/, '') });
    }
  }
}
const cityCounts = cityFiles.reduce((acc, item) => {
  acc[item.vertical] = (acc[item.vertical] || 0) + 1;
  return acc;
}, {});

const activeBatches = phase6Batches.filter(b => b.vertical === activeVertical);
const overallTopBatches = phase6LayerPlan.buckets.slice().sort((a, b) => b.count - a.count).slice(0, 5);

const changedSurfaceSummary = {
  active_vertical: activeVertical,
  active_site_url: site.siteUrl,
  active_page_set_file: site.pageSetFile,
  layer_buckets: phase6LayerPlan.buckets,
  active_vertical_batches: activeBatches.map(batch => ({
    vertical: batch.vertical,
    layer_bucket: batch.layer_bucket,
    count: batch.count,
    sample_urls: batch.urls.slice(0, 12),
  })),
  guide_registry_route_count: Object.keys(guideRegistry).length,
  city_content_counts: cityCounts,
  pdf_recommendation_summary: phase6Summary,
};

const criticalReleasePaths = [
  'package.json',
  'data/site.json',
  'data/contracts/guide_answer_shape_contract.json',
  'data/contracts/guide_enhancement_registry.json',
  'data/contracts/layer_source_of_truth_map.json',
  'reports/phase6_pdf_recommendations.summary.json',
  'reports/phase6_recommendation_batches.json',
  'scripts/build_city_sites.js',
  'scripts/prepare_site.js',
  'scripts/validate_core.js',
  'scripts/validate_llm_surface.js',
  'scripts/validate_coverage_parity.js',
  'scripts/reference/generate_from_candidates.js',
  'scripts/release/build_phase7_review_bundle.js',
  'scripts/release/build_phase7_release_notes.js'
].filter(rel => exists(rel));

const candidateRoutes = [];
candidateRoutes.push('/');
candidateRoutes.push('/guides');
for (const item of cityFiles.filter(x => x.vertical === activeVertical).slice(0, 6)) candidateRoutes.push(`/${item.slug}`);
for (const route of Object.keys(guideRegistry).slice(0, 8)) candidateRoutes.push(route);
for (const batch of activeBatches.slice(0, 2)) {
  for (const url of batch.urls.slice(0, 10)) {
    if (typeof url === 'string' && (url.startsWith('http') || url.startsWith('/'))) candidateRoutes.push(url);
  }
}
const normalizedTargets = uniq(candidateRoutes)
  .map(route => {
    const stripped = route.replace(/^https?:\/\/[^/]+/, '');
    return {
      route: stripped || '/',
      url: route.startsWith('http') ? route : `${(site.siteUrl || '').replace(/\/$/, '')}${stripped}`,
      exists_in_dist: distRouteExists(route),
    };
  })
  .filter(item => item.route)
  .slice(0, 25);

const clickAuditTargets = {
  active_vertical: activeVertical,
  generated_at: new Date().toISOString(),
  target_count: normalizedTargets.length,
  targets: normalizedTargets,
};

const reviewSummary = {
  generated_at: new Date().toISOString(),
  active_vertical: activeVertical,
  site: site,
  phases_verified_by_file_presence: {
    phase0a: exists('scripts/validation/phase0a_city_content_normalization.js'),
    phase0b: exists('scripts/validation/phase0b_layer_inventory_contract.js'),
    phase1: exists('scripts/validation/phase1_answer_shape_registry.js'),
    phase2: exists('scripts/validation/phase2_rendered_answer_shapes.js'),
    phase3: exists('scripts/validation/phase3_city_intelligence_contract.js'),
    phase4: exists('scripts/validation/phase4_named_city_enrichment.js'),
    phase45: exists('scripts/validation/phase45_multi_vertical_city_enrichment.js'),
    phase5: exists('scripts/validation/phase5_validator_audit.js'),
    phase6: exists('scripts/validation/phase6_recommendation_outputs.js'),
    phase7: true,
  },
  counts: {
    guide_registry_routes: Object.keys(guideRegistry).length,
    city_content_total: cityFiles.length,
    city_content_by_vertical: cityCounts,
    recommendation_records: phase6Summary.recommendation_count,
    recommendation_pdfs: phase6Summary.pdf_count,
    active_vertical_batch_count: activeBatches.reduce((sum, b) => sum + b.count, 0),
    dist_top_level_entries: distRoutes,
  },
  top_review_buckets: overallTopBatches,
  active_vertical_review_batches: activeBatches.map(batch => ({
    layer_bucket: batch.layer_bucket,
    count: batch.count,
    first_urls: batch.urls.slice(0, 10),
  })),
  release_watchlist_paths: criticalReleasePaths,
  click_audit_targets_file: 'reports/phase7_click_audit_targets.json',
  changed_surface_summary_file: 'reports/phase7_changed_surfaces_summary.json',
};

writeJson('reports/phase7_pr_review_summary.json', reviewSummary);
writeJson('reports/phase7_changed_surfaces_summary.json', changedSurfaceSummary);
writeJson('reports/phase7_click_audit_targets.json', clickAuditTargets);
writeJson('docs/releases/CRITICAL_SURFACES.json', { critical_surfaces: { release_watchlist: criticalReleasePaths } });

console.log('Wrote Phase 7 review bundle outputs.');
