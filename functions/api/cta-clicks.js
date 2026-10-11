// Cloudflare Pages Function
// Endpoint: GET /api/cta-clicks?ref=<ref>
// Purpose: read back how many clicks a registered audience CTA received in the
// last 28 days, so the daily cycle (scripts/search_intelligence/collect_cta_clicks.mjs)
// can record them. Clicks are written by /api/track-connection-click into the
// Airtable clicks table with button_source = ref and provider_type = "cta:<ref>".
// Returns an aggregate count only - never a record, never a field value - and
// only for the refs below (data/search_intelligence/audience_ctas.json is the
// source; scripts/validation/site_hygiene_registry_contract.js fails if the
// two lists drift).
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
  if (!CTA_REFS.includes(ref)) return json({ ok: false, error: 'unknown_ref', refs: CTA_REFS }, 400);
  const baseId = String(env.AIRTABLE_BASE_ID || '').trim();
  const table = String(env.AIRTABLE_CLICKS_TABLE_NAME || '').trim();
  const token = String(env.AIRTABLE_API_TOKEN || '').trim();
  if (!baseId || !table || !token) {
    return json({ ok: false, ref, state: 'NAMED_STOP', reason: 'Airtable clicks table is not configured on this Pages project' }, 503);
  }
  const formula = `IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -${WINDOW_DAYS}, 'days'))`;
  const tag = 'cta:' + ref;
  let clicks = 0;
  let scanned = 0;
  let offset = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100&filterByFormula=${encodeURIComponent(formula)}` + (offset ? `&offset=${encodeURIComponent(offset)}` : '');
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) {
      return json({ ok: false, ref, state: 'NAMED_STOP', reason: `Airtable read returned ${res.status}; the token needs data.records:read on the clicks table` }, 502);
    }
    const body = await res.json();
    for (const rec of body.records || []) {
      scanned += 1;
      const values = Object.values(rec.fields || {}).map((v) => String(v));
      if (values.includes(ref) || values.includes(tag)) clicks += 1;
    }
    offset = body.offset || '';
    if (!offset) break;
  }
  return json({ ok: true, ref, state: 'OK', window_days: WINDOW_DAYS, clicks, scanned, truncated: Boolean(offset) });
}
