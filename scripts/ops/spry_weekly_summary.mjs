#!/usr/bin/env node
/**
 * THE SPRY LABS WEEKLY HAND-OFF (owner, 1 Nov 2026). This writes spry-weekly-summary.json (schema
 * spry-weekly-summary-v1) from reports/weekly_outcome_report.json; the workflow uploads it as the
 * artifact `spry-weekly-summary`, and Boss OS puts one short section for the Industry Guides sites
 * into the one "Spry Labs weekly" email (Wednesdays 08:15 Central). Facts only: Boss OS words them.
 *
 *   node scripts/ops/spry_weekly_summary.mjs [report.json] [out.json]
 *   node scripts/ops/spry_weekly_summary.mjs --self-check
 */
import { readFileSync, writeFileSync } from 'node:fs';

export function summarise(report, runUrl = null) {
  const sites = (report?.hosts ?? []).map((h) => ({
    host: h.host,
    state: h.red ? 'needs-a-look' : 'fine',
    why: (h.why ?? []).slice(0, 3).map(String),
    clicks: h.clicks ?? null,
    impressions: h.impressions ?? null,
    prev_clicks: h.prev_clicks ?? null,
    prev_impressions: h.prev_impressions ?? null,
  }));
  if (sites.length === 0) throw new Error('NAMED STOP [NO_SITES] the weekly report covers no site; nothing to hand to Boss OS.');
  return {
    schema: 'spry-weekly-summary-v1', business: 'Local guides', week: (report.run_at ?? '').slice(0, 10) || null,
    generated_at: report.run_at ?? new Date().toISOString(), run_url: runUrl, sites, notes: [],
  };
}

export function selfCheck() {
  const r = summarise({ run_at: '2026-11-04T13:00:00Z', hosts: [{ host: 'a.example', red: false, clicks: 3 }, { host: 'b.example', red: true, why: ['clicks fell 40%'] }] });
  if (r.sites[0].state !== 'fine' || r.sites[1].state !== 'needs-a-look' || r.sites[1].why[0] !== 'clicks fell 40%') throw new Error('self-check: summary is wrong');
  let refused = false;
  try { summarise({ hosts: [] }); } catch { refused = true; }
  if (!refused) throw new Error('self-check: an empty report was handed on (rule 0)');
  console.log('spry_weekly_summary self-check: ok');
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === '--self-check') selfCheck();
else if (import.meta.url === `file://${process.argv[1]}`) {
  const [input = 'reports/weekly_outcome_report.json', out = 'spry-weekly-summary.json'] = process.argv.slice(2);
  const summary = summarise(JSON.parse(readFileSync(input, 'utf8')), process.env.RUN_URL ?? null);
  writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`spry weekly summary: ${summary.sites.length} site(s) -> ${out}`);
}
