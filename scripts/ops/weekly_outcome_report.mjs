#!/usr/bin/env node
/**
 * Weekly outcome report: week-over-week search performance per site.
 *
 * Why this exists. The repo measures Search Console truth for all six canonical
 * hosts every day (.github/workflows/rotating_refresh.yml writes
 * data/search_intelligence/<host>/), and nothing ever read two of those
 * snapshots together. A drop in clicks or a coverage regression sat in the data
 * for as long as nobody happened to look - Search Readiness item i9 ("weekly
 * outcome report: week-over-week per site, one self-closing issue per red
 * site") failed on every host.
 *
 * What it reads (committed measurement, no network, no model, nothing paid):
 *   data/search_intelligence/<host>/gsc_search_analytics_export.json  totals
 *   data/search_intelligence/<host>/index_coverage.json               state
 *   data/signals/weekly_outcome_history.json                          last run
 *
 * What it writes:
 *   reports/weekly_outcome_report.md    the human report
 *   reports/weekly_outcome_report.json  the same numbers, and `red` per host
 *   data/signals/weekly_outcome_history.json  this week's totals, for next week
 *
 * A host is red when any of these is true, and each reason names its numbers:
 *   - clicks fell by more than 30% week over week (and last week had >= 5)
 *   - impressions fell by more than 40% week over week (and last week had >= 50)
 *   - index coverage reports a named stop, or a non-OK state
 *   - the measurement itself is more than 10 days old (nothing is being measured)
 *
 * Exit code is 0 even when hosts are red: the report is the product, and the
 * workflow turns red hosts into one self-closing issue each. It exits 1 only
 * when it cannot do its job (no measurement to read at all), because a report
 * that silently covers nothing is the defect this is here to remove.
 *
 * Usage: node scripts/ops/weekly_outcome_report.mjs [--no-write]
 */
import fs from 'node:fs';
import path from 'node:path';

const WRITE = !process.argv.includes('--no-write');
const SI = path.join('data', 'search_intelligence');
const HISTORY = path.join('data', 'signals', 'weekly_outcome_history.json');
const OUT_MD = path.join('reports', 'weekly_outcome_report.md');
const OUT_JSON = path.join('reports', 'weekly_outcome_report.json');
const STALE_DAYS = 10;

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

const cfg = readJson('distribution.config.json') || {};
const hosts = (cfg.indexnow?.hosts || []).slice();
if (!hosts.length) {
  console.error('weekly_outcome_report: no hosts in distribution.config.json.');
  process.exit(1);
}

const history = readJson(HISTORY) || { schema: 'weekly-outcome-history-v1', weeks: [] };
const previous = history.weeks.length ? history.weeks[history.weeks.length - 1] : null;
const runAt = new Date().toISOString();
const rows = [];
let measured = 0;

const pct = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);
const arrow = (d) => (d === null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`);

for (const host of hosts) {
  const sa = readJson(path.join(SI, host, 'gsc_search_analytics_export.json'));
  const cov = readJson(path.join(SI, host, 'index_coverage.json'));
  const row = { host, clicks: null, impressions: null, position: null, coverage: null, collected_at: null, red: false, why: [] };

  if (!sa || !sa.totals) {
    row.why.push('no Search Console export to read');
  } else {
    measured += 1;
    row.clicks = Number(sa.totals.clicks || 0);
    row.impressions = Number(sa.totals.impressions || 0);
    row.position = sa.totals.position == null ? null : Number(sa.totals.position);
    row.collected_at = sa.collected_at || null;
    row.window = sa.start_date && sa.end_date ? `${sa.start_date}..${sa.end_date}` : null;
    if (row.collected_at) {
      const ageDays = (Date.now() - Date.parse(row.collected_at)) / 86400000;
      if (Number.isFinite(ageDays) && ageDays > STALE_DAYS) {
        row.why.push(`measurement is ${ageDays.toFixed(0)} days old (nothing is measuring this site)`);
      }
    }
  }

  if (cov) {
    row.coverage = cov.state || null;
    if (cov.named_stop) row.why.push(`index coverage named stop: ${cov.named_stop}`);
    else if (cov.state && cov.state !== 'OK') row.why.push(`index coverage state is ${cov.state}`);
  }

  const before = previous?.hosts?.[host];
  if (before) {
    row.prev_clicks = before.clicks ?? null;
    row.prev_impressions = before.impressions ?? null;
    row.d_clicks = pct(row.clicks ?? 0, before.clicks ?? 0);
    row.d_impressions = pct(row.impressions ?? 0, before.impressions ?? 0);
    // Floors so a site with 2 clicks does not go red for losing one.
    if ((before.clicks ?? 0) >= 5 && row.d_clicks !== null && row.d_clicks < -30) {
      row.why.push(`clicks ${before.clicks} -> ${row.clicks} (${arrow(row.d_clicks)})`);
    }
    if ((before.impressions ?? 0) >= 50 && row.d_impressions !== null && row.d_impressions < -40) {
      row.why.push(`impressions ${before.impressions} -> ${row.impressions} (${arrow(row.d_impressions)})`);
    }
  }

  row.red = row.why.length > 0;
  rows.push(row);
}

if (!measured) {
  console.error(`❌ WEEKLY OUTCOME REPORT FAIL — none of the ${hosts.length} hosts has a Search Console export in ${SI}. Nothing was measured, so there is no report to write.`);
  process.exit(1);
}

const red = rows.filter((r) => r.red);
const md = [];
md.push(`# Weekly outcome report — ${runAt.slice(0, 10)}`);
md.push('');
md.push(previous ? `Week over week against ${previous.run_at.slice(0, 10)}.` : 'First run: no previous week to compare against yet.');
md.push('');
md.push('| Site | Clicks | Δ | Impressions | Δ | Avg position | Coverage |');
md.push('|---|---:|---:|---:|---:|---:|---|');
for (const r of rows) {
  md.push(`| ${r.host} | ${r.clicks ?? '—'} | ${arrow(r.d_clicks ?? null)} | ${r.impressions ?? '—'} | ${arrow(r.d_impressions ?? null)} | ${r.position == null ? '—' : r.position.toFixed(1)} | ${r.coverage ?? '—'} |`);
}
md.push('');
if (red.length) {
  md.push(`## ${red.length} site(s) need attention`);
  md.push('');
  for (const r of red) {
    md.push(`### ${r.host}`);
    for (const w of r.why) md.push(`- ${w}`);
    md.push('');
  }
} else {
  md.push('## No site is red this week');
  md.push('');
  md.push('Every site has a fresh measurement, index coverage is OK, and no site lost clicks or impressions beyond the thresholds.');
  md.push('');
}
const report = { schema: 'weekly-outcome-report-v1', run_at: runAt, thresholds: { clicks_drop_pct: 30, impressions_drop_pct: 40, stale_days: STALE_DAYS }, hosts: rows, red: red.map((r) => r.host) };

if (WRITE) {
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(OUT_MD, `${md.join('\n')}\n`, 'utf8');
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  // Keep the last 12 weeks: enough to see a trend, small enough to read.
  history.weeks.push({ run_at: runAt, hosts: Object.fromEntries(rows.map((r) => [r.host, { clicks: r.clicks, impressions: r.impressions }])) });
  history.weeks = history.weeks.slice(-12);
  fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
  fs.writeFileSync(HISTORY, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

console.log(md.join('\n'));
console.log('');
console.log(`weekly_outcome_report: ${rows.length} site(s), ${measured} measured, ${red.length} red${WRITE ? `; wrote ${OUT_MD} and ${OUT_JSON}` : ' (no-write)'}`);
