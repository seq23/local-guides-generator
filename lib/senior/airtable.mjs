/**
 * Optional Airtable mirror of a senior lead row. Runs only when AIRTABLE_* are present,
 * never blocks the lead (D1 is the system of record), and prunes columns the table does
 * not have exactly as functions/api/request-assistance.js does.
 */
import { redactForLog, log } from './util.mjs';

const COLUMNS = ['id', 'created_at', 'kind', 'who_for', 'zip', 'care_tier', 'memory_care', 'budget_band', 'timeline', 'status',
  'unsellable_reason', 'name', 'email', 'phone', 'src', 'intent_type', 'button_source', 'vertical_key', 'page_kind', 'page_slug', 'market_slug', 'source_domain'];

export async function mirrorToAirtable(env, lead) {
  const baseId = String(env.AIRTABLE_BASE_ID || '').trim();
  const table = String(env.AIRTABLE_TABLE_NAME || '').trim();
  const tok = String(env.AIRTABLE_API_TOKEN || '').trim();
  if (!baseId || !table || !tok) return { ok: false, reason: 'missing_airtable_env' };
  const fields = {};
  for (const c of COLUMNS) if (lead[c] !== null && lead[c] !== undefined && lead[c] !== '') fields[c === 'id' ? 'lead_id' : c] = String(lead[c]);
  fields.provider_type = 'Senior living';
  fields.consent = 'yes';
  for (let i = 0; i < 16; i += 1) {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ records: [{ fields }] })
    });
    if (res.ok) return { ok: true };
    const text = (await res.text().catch(() => '')).slice(0, 400);
    const m = text.match(/Unknown field name:\s*\\?"([^"\\]+)/i);
    if (!m || !(m[1] in fields)) { log('error', 'airtable mirror failed', res.status, redactForLog(text)); return { ok: false }; }
    delete fields[m[1]];
  }
  return { ok: false };
}
