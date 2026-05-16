#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
const site = readJson('data/site.json');
const review = readJson('reports/phase7_pr_review_summary.json');
const changed = readJson('reports/phase7_changed_surfaces_summary.json');
const clickAudit = readJson('reports/phase7_click_audit_targets.json');

const lines = [];
lines.push('# Phase 7 Release Notes');
lines.push('');
lines.push(`- Generated: ${new Date().toISOString()}`);
lines.push(`- Active site: ${site.siteUrl}`);
lines.push(`- Active page set: ${site.pageSetFile}`);
lines.push(`- Active vertical: ${review.active_vertical}`);
lines.push('');
lines.push('## What this phase adds');
lines.push('');
lines.push('- Machine-readable PR review summary for the current repo state.');
lines.push('- Changed-surface summary grouped by layer and vertical.');
lines.push('- Click-audit target list for manual post-build review.');
lines.push('- Release watchlist used by release guard.');
lines.push('');
lines.push('## Current structural counts');
lines.push('');
lines.push(`- Guide registry routes: ${review.counts.guide_registry_routes}`);
lines.push(`- City content records: ${review.counts.city_content_total}`);
lines.push(`- Recommendation records: ${review.counts.recommendation_records}`);
lines.push(`- PDFs normalized: ${review.counts.recommendation_pdfs}`);
lines.push('');
lines.push('## Highest-priority review buckets');
lines.push('');
for (const bucket of review.top_review_buckets) {
  lines.push(`- ${bucket.vertical} · ${bucket.layer_bucket} · ${bucket.count}`);
}
lines.push('');
lines.push('## Active-vertical batch focus');
lines.push('');
for (const batch of review.active_vertical_review_batches) {
  lines.push(`- ${batch.layer_bucket}: ${batch.count} recommended fixes`);
}
lines.push('');
lines.push('## Click-audit target count');
lines.push('');
lines.push(`- ${clickAudit.target_count} targets listed in reports/phase7_click_audit_targets.json`);
lines.push('');
lines.push('## Release watchlist');
lines.push('');
for (const rel of review.release_watchlist_paths) lines.push(`- ${rel}`);
lines.push('');
fs.writeFileSync(path.join(root, 'reports', 'phase7_snapshot_release_notes.md'), lines.join('\n') + '\n');
console.log('Wrote Phase 7 release notes.');
