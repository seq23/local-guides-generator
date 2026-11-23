// Cloudflare Pages Function
// Endpoint: GET /api/cta-clicks?ref=<ref>
// Purpose: read back how many clicks a registered audience CTA received in the
// last 28 days, so the daily cycle (scripts/search_intelligence/collect_cta_clicks.mjs)
// can record them. Clicks are written by /api/track-connection-click into the
// Airtable clicks table with button_source = ref and provider_type = "cta:<ref>".
// Returns an aggregate count only - never a record, never a field value - and
// only for the refs below (data/search_intelligence/audience_ctas.json is the
// source; scripts/validation/site_hygiene_registry_contract.js fails if the
// two lists drift). A read that cannot complete answers 200 with state NAMED_STOP
// and the reason, so the cycle records why (a 5xx is masked by the edge's own page).
// Public answer (security sweep, 23 Nov 2026): the ref's click total for the window and
// whether that total is complete, nothing else; an unknown ref is refused without
// naming the registered ones, and a failed read gives a short reason code. The detail
// (records scanned, the vendor's own error text) needs the x-senior-tick-token header
// matching SENIOR_TICK_TOKEN (compared in constant time); the daily collector sends it.
// Click totals count unique clicks: the same click from one IP inside 30 minutes is
// written once (functions/api/track-connection-click.js, lib/abuse_guard.mjs).
import { secretMatches } from '../../lib/abuse_guard.mjs';

export const CTA_REFS = ['dentistry-license-get-listed', 'uscis-field-office-civil-surgeon'];
const WINDOW_DAYS = 28;
const MAX_PAGES = 20;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const ref = String(new URL(context.request.url).searchParams.get('ref') || '').trim();
  if (!CTA_REFS.includes(ref)) return json({ ok: false, error: 'unknown_ref' }, 400);
  const detail = await secretMatches(env.SENIOR_TICK_TOKEN, context.request.headers.get('x-senior-tick-token'));
  const stop = (code, why) => json({ ok: false, ref, state: 'NAMED_STOP', reason: detail ? `${code}: ${why}` : code });
  const baseId = String(env.AIRTABLE_BASE_ID || '').trim();
  const table = String(env.AIRTABLE_CLICKS_TABLE_NAME || '').trim();
  const token = String(env.AIRTABLE_API_TOKEN || '').trim();
  if (!baseId || !table || !token) {
    return stop('not_configured', 'Airtable clicks table is not configured on this Pages project');
  }
  const formula = `IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -${WINDOW_DAYS}, 'days'))`;
  const tag = 'cta:' + ref;
  let clicks = 0;
  let scanned = 0;
  let offset = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100&filterByFormula=${encodeURIComponent(formula)}` + (offset ? `&offset=${encodeURIComponent(offset)}` : '');
    let res;
    try {
      res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    } catch (e) {
      return stop('airtable_unreachable', String(e && e.message || e).slice(0, 120));
    }
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).replace(/[^\w .:,-]/g, ' ').slice(0, 160);
      return stop(`airtable_${res.status}`, `${text}; the token needs data.records:read on the clicks table`);
    }
    const body = await res.json().catch(() => null);
    if (!body) return stop('airtable_unreadable', 'Airtable answered with a body that is not JSON');
    for (const rec of body.records || []) {
      scanned += 1;
      const values = Object.values(rec.fields || {}).map((v) => String(v));
      if (values.includes(ref) || values.includes(tag)) clicks += 1;
    }
    offset = body.offset || '';
    if (!offset) break;
  }
  const out = { ok: true, ref, state: 'OK', window_days: WINDOW_DAYS, clicks, truncated: Boolean(offset) };
  if (detail) out.scanned = scanned;
  return json(out);
}
