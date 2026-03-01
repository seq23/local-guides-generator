// Cloudflare Pages Function
// Endpoint: POST /api/request-assistance
// Purpose: store request-assistance lead capture into Airtable (free tier) OR email fallback.
// Contract:
//   - Minimal data: provider_type, email, consent (required), phone (optional), zip (optional), src (optional)
//   - No case details / no free-text message field (compliance + minimization)
//   - Honeypot: website (must be empty)
//   - Strict enum for provider_type (prevents drift)

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
    const consent = String(body.consent || '').trim();
    const phone = normalizePhone(body.phone || '');
    const zip = normalizeZip(body.zip || '');
    const src = String(body.src || '').trim().slice(0, 120);

    if (!provider_type || !ALLOWED_PROVIDER_TYPES.has(provider_type)) {
      return json({ ok: false, error: 'provider_type' }, { status: 400 });
    }
    if (!email || !isEmail(email)) {
      return json({ ok: false, error: 'email' }, { status: 400 });
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
      email,
      phone: phone || '',
      zip: zip || '',
      src: src || '',
      source_domain: host,
      consent: 'yes',
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
