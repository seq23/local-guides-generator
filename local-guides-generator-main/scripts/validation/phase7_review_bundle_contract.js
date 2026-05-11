#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
function fail(msg){ console.error(`❌ ${msg}`); process.exit(1); }
function readJson(rel){ return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function ensure(rel){ if (!fs.existsSync(path.join(root, rel))) fail(`missing required Phase 7 file: ${rel}`); }
['reports/phase7_pr_review_summary.json','reports/phase7_changed_surfaces_summary.json','reports/phase7_click_audit_targets.json','reports/phase7_snapshot_release_notes.md','docs/releases/CRITICAL_SURFACES.json'].forEach(ensure);
const review = readJson('reports/phase7_pr_review_summary.json');
const changed = readJson('reports/phase7_changed_surfaces_summary.json');
const clickAudit = readJson('reports/phase7_click_audit_targets.json');
const watchlist = readJson('docs/releases/CRITICAL_SURFACES.json');
if (!review.active_vertical) fail('phase7 review summary missing active_vertical');
if (!review.site || !review.site.siteUrl || !review.site.pageSetFile) fail('phase7 review summary missing site details');
if (!Array.isArray(review.top_review_buckets) || review.top_review_buckets.length === 0) fail('phase7 review summary missing top_review_buckets');
if (!changed.pdf_recommendation_summary || typeof changed.pdf_recommendation_summary.recommendation_count !== 'number') fail('changed surface summary missing pdf recommendation summary');
if (!Array.isArray(clickAudit.targets) || clickAudit.targets.length < 5) fail('click audit targets file too small');
if (!watchlist.critical_surfaces || !Array.isArray(watchlist.critical_surfaces.release_watchlist) || watchlist.critical_surfaces.release_watchlist.length < 5) fail('release watchlist missing or too small');
console.log('OK: Phase 7 review bundle contract valid');
