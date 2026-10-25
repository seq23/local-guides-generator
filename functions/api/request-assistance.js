/**
 * Cloudflare Pages Function for POST /api/request-assistance.
 *
 * Purpose:
 * - Accept structured provider lead-capture requests from the public request-assistance page.
 * - Validate a compliance-safe payload.
 * - Write qualified requests into Airtable when production environment variables are configured.
 *
 * Accepted input:
 * - provider_type (required enum)
 * - service_needed (evaluation | therapy | both; required with the neuro
 *   evaluation-or-therapy provider type, optional and enum-checked otherwise)
 * - email or phone (at least one required)
 * - consent (required)
 * - phone (optional)
 * - zip (optional)
 * - src, intent_type, button_source, vertical_key, page_kind, page_slug, market_slug (optional)
 * - website (honeypot; must remain empty)
 *
 * Output:
 * - JSON success or validation-failure response.
 * - `storage` reports where the lead actually went: "airtable" (system of
 *   record) or "email_fallback" (Airtable refused it; a person must re-enter
 *   it by hand). A 200 alone does not mean Airtable accepted the lead.
 *
 * Storage order:
 * - Airtable write, retrying past any column the table does not have.
 * - Email relay, which fires on every accepted lead so a vendor outage can
 *   never make a lead disappear silently.
 *
 * Failure modes:
 * - Unsupported content type
 * - Invalid provider_type
 * - Missing email and phone
 * - Missing consent
 * - Missing Airtable environment variables
 * - Airtable write failure (falls back to email; only a failure of both is 503)
 */

const ALLOWED_PROVIDER_TYPES = new Set([
  'Personal Injury Attorney',
  'Dentist (Cosmetic, Implant, or General Care)',
  // Before 16 Oct 2026 the neuro label; the other sites' shared request page
  // still lists it, so it stays accepted.
  'Neuro Evaluation Provider',
  'ADHD / autism evaluation or therapy provider',
  'Hormone / Wellness Clinic',
  // hormonesivhair.com welcomes women seeking menopause / perimenopause HRT (owner,
  // 16 Oct 2026). Mirrors WOMENS_HRT_PROVIDER_TYPE in scripts/lib/trt_affiliates.js;
  // tests/trt/trt_affiliates.test.mjs fails if the two differ.
  "Menopause / women's HRT clinic",
  'USCIS Medical Exam Provider'
]);

// neuroevalguides.com asks evaluation / therapy / both first (owner, 16 Oct
// 2026) so a lead can be routed to an evaluator, a therapy practice, or a
// practice that does both. Mirrors scripts/lib/neuro_services.js (this file
// runs on Cloudflare and cannot import it); tests/neuro/neuro_services.test.mjs
// fails if the two differ.
const NEURO_PROVIDER_TYPE = 'ADHD / autism evaluation or therapy provider';
const SERVICE_NEEDED_VALUES = new Set(['evaluation', 'therapy', 'both']);

// Every lead names the site it came from (owner, 25 Oct 2026). The forms carry
// vertical_key; a form that does not (a cached page, a hand-built link) gets it
// from the host the request reached. Mirrors PACK_SITE_CONFIG in
// scripts/lib/pack_site_config.js and the pages projects in
// config/edge_cache.json (this file runs on Cloudflare and cannot import them);
// tests/request_form/own_vertical.test.mjs fails if they differ.
const HOST_VERTICAL = {
  'theaccidentguides.com': 'pi',
  'local-guides-generator-pi.pages.dev': 'pi',
  'dentistryguides.com': 'dentistry',
  'thedentistryguides.com': 'dentistry',
  'local-guides-generator-dentistry.pages.dev': 'dentistry',
  'neuroevalguides.com': 'neuro',
  'local-guides-generator-neuro.pages.dev': 'neuro',
  'hormonesivhair.com': 'trt',
  'local-guides-generator-trt.pages.dev': 'trt',
  'uscisexam.com': 'uscis_medical',
  'local-guides-generator-uscis-medical.pages.dev': 'uscis_medical'
};

function verticalForHost(host) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  if (HOST_VERTICAL[h]) return HOST_VERTICAL[h];
  // Preview deployments: <hash>.local-guides-generator-<pack>.pages.dev
  const preview = h.match(/^[a-z0-9-]+\.(local-guides-generator-[a-z-]+\.pages\.dev)$/);
  return preview && HOST_VERTICAL[preview[1]] ? HOST_VERTICAL[preview[1]] : '';
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {})
    }
  });
}

function isEmail(s) {
  const t = String(s || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function normalizeZip(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (/^\d{5}$/.test(t)) return t;
  if (/^\d{5}-\d{4}$/.test(t)) return t;
  return '';
}

function normalizePhone(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  // Keep as-entered but strip obviously dangerous chars.
  return t.replace(/[^0-9()+\- .]/g, '').slice(0, 32);
}

// Airtable rejects an entire record if it mentions a single column the table
// does not have, and it names only ONE offending column per response. Verified
// 2026-08-26 against base appDgpv4F5ORCtUU3: the payload below carried seven
// attribution columns that "Lead Requests" never had, so every lead this
// endpoint ever collected was rejected with
//   422 {"error":{"type":"UNKNOWN_FIELD_NAME","message":"Unknown field name: \"intent_type\""}}
// A hardcoded column list would break again the next time the table is edited
// in the Airtable UI, so instead we strip whatever Airtable names and retry,
// preserving the stripped values in the long-text Notes column. That means the
// table's schema can drift in either direction without dropping a lead.
const MAX_FIELD_PRUNE_ATTEMPTS = 16;

function parseUnknownFieldName(text) {
  try {
    const err = (JSON.parse(text) || {}).error;
    if (!err || err.type !== 'UNKNOWN_FIELD_NAME') return '';
    const m = String(err.message || '').match(/Unknown field name:\s*"([^"]+)"/i);
    return m ? m[1] : '';
  } catch (_) {
    return '';
  }
}

// Airtable quotes offending values back in some of its error messages, and
// those messages are the thing worth logging. Mask anything shaped like a
// submitted contact detail first, so diagnosing a vendor error can never be
// the reason a lead's email or phone number ends up in a log.
function redactForLog(text) {
  return String(text || '')
    .replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@]+/g, '[email]')
    .replace(/\+?[\d][\d()\-. ]{7,}\d/g, '[phone]');
}

function formatDroppedFields(dropped) {
  return Object.entries(dropped)
    .filter(([, v]) => String(v == null ? '' : v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

async function writeToAirtable({ env, record, notesField = '' }) {
  const baseId = String(env.AIRTABLE_BASE_ID || '').trim();
  const tableName = String(env.AIRTABLE_TABLE_NAME || '').trim();
  const token = String(env.AIRTABLE_API_TOKEN || '').trim();

  if (!baseId || !tableName || !token) {
    return { ok: false, reason: 'missing_airtable_env' };
  }

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const fields = { ...record };
  const dropped = {};
  let notesSupported = Boolean(notesField);
  let lastStatus = 0;
  let lastDetails = '';

  for (let attempt = 0; attempt < MAX_FIELD_PRUNE_ATTEMPTS; attempt += 1) {
    const payload = { ...fields };
    if (notesSupported) {
      const carried = formatDroppedFields(dropped);
      if (carried) {
        payload[notesField] = `Columns missing from this table:\n${carried}`;
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ records: [{ fields: payload }] })
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const id = (((data || {}).records || [])[0] || {}).id || '';
      return { ok: true, id, droppedFields: Object.keys(dropped) };
    }

    lastStatus = res.status;
    lastDetails = (await res.text().catch(() => '')).slice(0, 400);

    const unknown = parseUnknownFieldName(lastDetails);
    if (!unknown) break;
    if (notesSupported && unknown === notesField) {
      // The table has no Notes column either; keep going without it.
      notesSupported = false;
      continue;
    }
    // Airtable named a column we are not sending, so retrying cannot help.
    if (!Object.prototype.hasOwnProperty.call(fields, unknown)) break;
    dropped[unknown] = fields[unknown];
    delete fields[unknown];
  }

  return {
    ok: false,
    reason: 'airtable_error',
    status: lastStatus,
    details: lastDetails,
    droppedFields: Object.keys(dropped)
  };
}

// The notification sender is part of the guides' identity, not deployment
// config: every guides site is a property of The Industry Guides alone, so the
// lead email goes out as The Industry Guides from its own verified domain
// (theindustryguides.com, verified in Resend). It is pinned here, not read
// from EMAIL_FROM, so a stale dashboard or wrangler.toml value can never put
// another company's sender back on these emails. The recipient
// (LEAD_TO) is where the owner reads leads, and stays deployment config.
const LEAD_FROM = 'The Industry Guides <hello@theindustryguides.com>';

async function relayLeadByEmail({ env, record, stored, reason }) {
  const key = String(env.RESEND_API_KEY || '').trim();
  // LEAD_TO accepts a comma-separated list. A lead notification that reaches
  // one mailbox is one spam filter away from reaching nobody, and the address
  // that turned out to be reachable is not always the one on the tin: mail to
  // a forwarding inbox can be accepted by Resend and still never surface,
  // because the forward breaks SPF alignment. Sending to each address directly
  // removes the single point of failure.
  const to = String(env.LEAD_TO || env.EMAIL_REPLY_TO || '')
    .split(',')
    .map((addr) => addr.trim())
    .filter(Boolean);
  const from = LEAD_FROM;
  if (!key || !to.length) return { ok: false, reason: 'missing_email_env' };

  // A blank attribution field reads "(not tagged)" so the email says what the
  // form failed to send rather than looking like a cut-off line.
  const lines = Object.entries(record).map(([k, v]) => `${k}: ${String(v == null ? '' : v).trim() === '' ? '(not tagged)' : v}`).join('\n');
  const where = record.market_slug || record.source_domain || '';
  const what = `${record.provider_type || 'request'}${record.service_needed ? ` (${record.service_needed})` : ''}`;
  const subject = stored
    ? `Lead - ${what}${where ? ` - ${where}` : ''}`
    : `Lead (Airtable down: ${reason}) - ${what}${where ? ` - ${where}` : ''}`;
  const preamble = stored
    ? 'This lead is stored in Airtable. This email is a notification copy.\n'
    : `Airtable write failed (${reason}), so this lead is being relayed by email.\nIt is NOT in Airtable and needs to be entered manually.\n`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: `${preamble}\n${lines}\n`
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, reason: `resend_${res.status}`, details: text.slice(0, 300) };
  }
  return { ok: true };
}



export async function onRequestPost(context) {
  try {
    const req = context.request;
    const env = context.env || {};

    const ct = String(req.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      return json({ ok: false, error: 'content_type' }, { status: 415 });
    }

    const body = await req.json().catch(() => ({}));

    const website = String(body.website || '').trim();
    if (website) {
      // Bot: pretend success to avoid training.
      return json({ ok: true });
    }

    const provider_type = String(body.provider_type || '').trim();
    const email = String(body.email || '').trim();
    const intent_type = String(body.intent_type || body.intent || '').trim().slice(0, 64);
    const button_source = String(body.button_source || body.button || '').trim().slice(0, 64);
    const vertical_key = String(body.vertical_key || body.vertical || '').trim().slice(0, 32);
    const page_kind = String(body.page_kind || '').trim().slice(0, 32);
    const page_slug = String(body.page_slug || '').trim().slice(0, 160);
    const market_slug = String(body.market_slug || body.market || '').trim().slice(0, 120);
    const sponsor_slug = String(body.sponsor_slug || '').trim().slice(0, 120);
    const sponsor_scope = String(body.sponsor_scope || '').trim().slice(0, 32);
    const campaign_slug = String(body.campaign_slug || '').trim().slice(0, 120);
    const lead_target = String(body.lead_target || '').trim().slice(0, 240);
    const consent = String(body.consent || '').trim();
    const phone = normalizePhone(body.phone || '');
    const zip = normalizeZip(body.zip || '');
    const src = String(body.src || '').trim().slice(0, 120);
    const service_needed = String(body.service_needed || '').trim().toLowerCase().slice(0, 16);

    if (!provider_type || !ALLOWED_PROVIDER_TYPES.has(provider_type)) {
      return json({ ok: false, error: 'provider_type' }, { status: 400 });
    }
    if (service_needed && !SERVICE_NEEDED_VALUES.has(service_needed)) {
      return json({ ok: false, error: 'service_needed' }, { status: 400 });
    }
    if (provider_type === NEURO_PROVIDER_TYPE && !service_needed) {
      return json({ ok: false, error: 'service_needed' }, { status: 400 });
    }
    if (email && !isEmail(email)) {
      return json({ ok: false, error: 'email' }, { status: 400 });
    }
    if (!email && !phone) {
      return json({ ok: false, error: 'contact_required' }, { status: 400 });
    }
    if (!consent) {
      return json({ ok: false, error: 'consent' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const host = (() => {
      try {
        const u = new URL(req.url);
        return u.host || '';
      } catch (_) {
        return '';
      }
    })();

    const record = {
      provider_type,
      // Only when asked: a key the Airtable table lacks costs a retry.
      ...(service_needed ? { service_needed } : {}),
      email: email || '',
      phone: phone || '',
      zip: zip || '',
      src: src || '',
      source_domain: host,
      consent: 'yes',
      intent_type: intent_type || '',
      button_source: button_source || '',
      vertical_key: vertical_key || verticalForHost(host),
      page_kind: page_kind || '',
      page_slug: page_slug || '',
      market_slug: market_slug || '',
      sponsor_slug: sponsor_slug || '',
      sponsor_scope: sponsor_scope || '',
      campaign_slug: campaign_slug || '',
      lead_target: lead_target || '',
      created_at: nowIso
    };

    const at = await writeToAirtable({ env, record, notesField: 'Notes' });

    if (!at.ok) {
      // Log the status and Airtable's own message: the difference between a
      // bad token (401/403), a wrong base or table (404), and a column the
      // table does not have (422) is the entire diagnosis, and without it this
      // endpoint reports "airtable_error" for all three. The record itself is
      // never logged, so no lead's personal data reaches the log.
      console.error(
        'request-assistance airtable failure',
        at.reason || 'unknown',
        `status=${at.status || 0}`,
        redactForLog(at.details)
      );
    } else if (at.droppedFields && at.droppedFields.length) {
      // The write landed, but the table is missing columns we tried to fill.
      // Their values are preserved in Notes; only the column names are logged.
      console.warn('request-assistance airtable missing columns', at.droppedFields.join(','));
    }

    // Airtable is the system of record, but losing a lead because a third
    // party is unavailable is the worst outcome this endpoint can produce, so
    // the email relay fires on every accepted lead rather than only on
    // failure. On success it is a notification copy; on failure it is the only
    // surviving copy and says so.
    const relayed = await relayLeadByEmail({
      env,
      record,
      stored: at.ok,
      reason: at.reason || 'unknown'
    });
    if (!relayed.ok) {
      console.error('request-assistance email relay failed', relayed.reason || 'unknown');
    }

    if (at.ok) return json({ ok: true, storage: 'airtable' });
    if (relayed.ok) return json({ ok: true, storage: 'email_fallback' });
    return json({ ok: false, error: 'storage_unavailable' }, { status: 503 });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
