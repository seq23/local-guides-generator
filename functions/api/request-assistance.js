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
 * - email or phone (at least one required)
 * - consent (required)
 * - phone (optional)
 * - zip (optional)
 * - src, intent_type, button_source, vertical_key, page_kind, page_slug, market_slug (optional)
 * - website (honeypot; must remain empty)
 *
 * Output:
 * - JSON success or validation-failure response.
 *
 * Failure modes:
 * - Unsupported content type
 * - Invalid provider_type
 * - Missing email and phone
 * - Missing consent
 * - Missing Airtable environment variables
 * - Airtable write failure
 */

const ALLOWED_PROVIDER_TYPES = new Set([
  'Personal Injury Attorney',
  'Dentist (Cosmetic, Implant, or General Care)',
  'Neuro Evaluation Provider',
  'Hormone / Wellness Clinic',
  'USCIS Medical Exam Provider'
]);

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

async function writeToAirtable({ env, record }) {
  const baseId = String(env.AIRTABLE_BASE_ID || '').trim();
  const tableName = String(env.AIRTABLE_TABLE_NAME || '').trim();
  const token = String(env.AIRTABLE_API_TOKEN || '').trim();

  if (!baseId || !tableName || !token) {
    return { ok: false, reason: 'missing_airtable_env' };
  }

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      records: [
        {
          fields: record
        }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, reason: 'airtable_error', details: text.slice(0, 400) };
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

    if (!provider_type || !ALLOWED_PROVIDER_TYPES.has(provider_type)) {
      return json({ ok: false, error: 'provider_type' }, { status: 400 });
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
      email: email || '',
      phone: phone || '',
      zip: zip || '',
      src: src || '',
      source_domain: host,
      consent: 'yes',
      intent_type: intent_type || '',
      button_source: button_source || '',
      vertical_key: vertical_key || '',
      page_kind: page_kind || '',
      page_slug: page_slug || '',
      market_slug: market_slug || '',
      sponsor_slug: sponsor_slug || '',
      sponsor_scope: sponsor_scope || '',
      campaign_slug: campaign_slug || '',
      lead_target: lead_target || '',
      created_at: nowIso
    };

    const at = await writeToAirtable({ env, record });
    if (!at.ok) {
      // Hard failure is acceptable here: user sees friendly error, build stays clean.
      return json({ ok: false, error: 'storage_unavailable' }, { status: 503 });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
