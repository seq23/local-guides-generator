#!/usr/bin/env node
// Daily: record the clicks each audience CTA received (data/search_intelligence/audience_ctas.json)
// into data/search_intelligence/<host>/cta_clicks.json, read back through the live
// GET /api/cta-clicks?ref=<ref> endpoint (functions/api/cta-clicks.js). An endpoint
// that cannot answer is recorded as a NAMED_STOP row with its reason - never a
// silent zero - and the step exits 0 so the rest of the cycle still commits.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SI = path.join(ROOT, 'data', 'search_intelligence');
const { ctas } = JSON.parse(fs.readFileSync(path.join(SI, 'audience_ctas.json'), 'utf8'));
if (!ctas.length) { console.error('collect_cta_clicks: audience_ctas.json registers no CTA'); process.exit(1); }
const now = new Date().toISOString();
const byHost = new Map();
for (const c of ctas) {
  let row;
  try {
    const res = await fetch(`https://${c.host}/api/cta-clicks?ref=${encodeURIComponent(c.ref)}`, { signal: AbortSignal.timeout(20000) });
    const body = await res.json().catch(() => ({}));
    row = body.ok
      ? { ref: c.ref, state: 'OK', clicks: body.clicks, window_days: body.window_days, scanned: body.scanned, truncated: body.truncated }
      : { ref: c.ref, state: 'NAMED_STOP', clicks: null, reason: body.reason || body.error || `HTTP ${res.status}` };
  } catch (e) {
    row = { ref: c.ref, state: 'NAMED_STOP', clicks: null, reason: `endpoint unreachable: ${String(e.message || e).slice(0, 200)}` };
  }
  row.collected_at = now;
  row.cta_href = c.cta_href;
  if (!byHost.has(c.host)) byHost.set(c.host, []);
  byHost.get(c.host).push(row);
  console.log(`${row.state === 'OK' ? 'OK' : 'NAMED STOP'}: ${c.host} ${c.ref} clicks=${row.clicks}${row.reason ? ` (${row.reason})` : ''}`);
}
for (const [host, rows] of byHost) {
  const file = path.join(SI, host, 'cta_clicks.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { history: [] };
  const history = [...(prev.history || []).filter((h) => h.date !== now.slice(0, 10)), { date: now.slice(0, 10), rows: rows.map(({ ref, state, clicks }) => ({ ref, state, clicks })) }].slice(-90);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ schema_version: '1.0', host, source: 'GET /api/cta-clicks (Airtable clicks table, rolling 28 days)', collected_at: now, ctas: rows, history }, null, 2) + '\n');
}
