#!/usr/bin/env node
'use strict';
// Read-only compiler: missing URL inspections are unknown, never "not indexed".
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const TARGETS = Object.freeze({
  'hormonesivhair.com': '/guides/greenville-testosterone-therapy-costs/',
  'neuroevalguides.com': '/guides/fayetteville-adhd-evaluation-testing-options/',
  'uscisexam.com': '/guides/fresno-i693-immigration-medical-exam-cost/',
  'theaccidentguides.com': '/guides/midland-odessa-texas-crash-report-requests/',
  'dentistryguides.com': '/guides/ocala-dental-new-patient-specials-compared/'
});
function compile(read) {
  const rows = [];
  for (const [host, urlPath] of Object.entries(TARGETS)) {
    const url = 'https://' + host + urlPath;
    let source;
    try { source = read(host); }
    catch (error) { rows.push({ host, url, status: 'SOURCE_MISSING', indexed: null, source_collected_at: null, inspected_at: null }); continue; }
    if (source.site_url !== 'sc-domain:' + host || source.truth_source !== 'google_search_console_url_inspection' || !Array.isArray(source.urls)) {
      rows.push({ host, url, status: 'SOURCE_INVALID', indexed: null, source_collected_at: source.collected_at || null, inspected_at: null });
      continue;
    }
    const match = source.urls.find(x => x.url === url);
    if (!match) {
      rows.push({ host, url, status: 'NOT_IN_SNAPSHOT', indexed: null, source_collected_at: source.collected_at || null, inspected_at: null });
      continue;
    }
    rows.push({ host, url, status: 'OBSERVED', indexed: match.bucket === 'indexed', bucket: match.bucket || null, coverage_state: match.coverageState || null, verdict: match.verdict || null, source_collected_at: source.collected_at || null, inspected_at: match.inspected_at || null, google_canonical: match.googleCanonical || null, user_canonical: match.userCanonical || null });
  }
  return { schema: 'industry-guides-exact-five-gsc-evidence-v1', scope: 'Checked-in GSC URL-inspection snapshots only; no live Google API call or HTTP validation. Missing is unknown.', rows };
}
function main() {
  const report = compile(host => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/search_intelligence', host, 'index_coverage.json'), 'utf8')));
  const output = process.argv[2];
  if (output) { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.rows.some(x => x.status === 'SOURCE_INVALID' || x.status === 'SOURCE_MISSING')) process.exitCode = 2;
}
if (require.main === module) main();
module.exports = { TARGETS, compile };
