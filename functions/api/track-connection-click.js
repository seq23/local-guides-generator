// Cloudflare Pages Function
// Endpoint: POST /api/track-connection-click
// Purpose: lightweight intent telemetry (optional). Warning-only if Airtable not configured.

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

async function writeToAirtable({ env, record }) {
  const baseId = String(env.AIRTABLE_BASE_ID || '').trim();
  const tableName = String(env.AIRTABLE_CLICKS_TABLE_NAME || '').trim();
  const token = String(env.AIRTABLE_API_TOKEN || '').trim();
  if (!baseId || !tableName || !token) return { ok: false };

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ records: [{ fields: record }] })
  });
  if (!res.ok) return { ok: false };
  return { ok: true };
}

export async function onRequestPost(context) {
  try {
    const req = context.request;
    const env = context.env || {};

    const ct = String(req.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      return json({ ok: true });
    }

    const body = await req.json().catch(() => ({}));
    const provider_type = String(body.provider_type || '').trim().slice(0, 80);
    const page_slug = String(body.page_slug || '').trim().slice(0, 160);
    const source_domain = String(body.source_domain || '').trim().slice(0, 120);
    const nowIso = new Date().toISOString();

    const at = await writeToAirtable({
      env,
      record: {
        provider_type,
        page_slug,
        source_domain,
        created_at: nowIso
      }
    });

    // Always return ok to avoid interfering with navigation.
    return json({ ok: true, stored: !!at.ok });
  } catch (_) {
    return json({ ok: true });
  }
}
