// Anonymous download events use the existing audit-event table and D1 binding.
// There is no lead, email, health answer, cookie, IP address or persistent ID.
const FILES = { parent: '/assets/binders/parent-binder.pdf', 'move-in': '/assets/binders/move-in-binder.pdf' };
export function sourcePage(raw) {
  const p = String(raw || '').split(/[?#]/)[0];
  return p.length <= 120 && /^\/(?:[a-z][a-z0-9-]*\/){0,3}$/.test(p) ? p : '/resources/binders/';
}
export async function handleBinderDownload({ request, env = {} }, deps = {}) {
  if (!env.SENIOR_DB || !env.ASSETS) return new Response('Not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const id = url.searchParams.get('binder');
  if (!Object.hasOwn(FILES, id)) return new Response('Not found', { status: 404 });
  const asset = await env.ASSETS.fetch(new Request(new URL(FILES[id], url.origin), { method: request.method }));
  if (asset.status !== 200 || !/application\/pdf/i.test(asset.headers.get('content-type') || '')) return new Response('PDF unavailable', { status: 503 });
  const headers = new Headers(asset.headers);
  headers.set('Content-Disposition', `attachment; filename="${id}-binder.pdf"`);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex');
  // HEAD and browser speculation are availability probes, not downloads.
  if (request.method === 'GET' && !/prefetch|prerender/i.test(request.headers.get('purpose') || request.headers.get('sec-purpose') || '')) {
    let ref = '';
    try { const r = new URL(request.headers.get('referer')); if (r.origin === url.origin) ref = r.pathname; } catch (_) {}
    const from = sourcePage(url.searchParams.get('from') || ref);
    try {
      await env.SENIOR_DB.prepare('INSERT INTO seat_events (at, event, detail) VALUES (?, ?, ?)')
        .bind(deps.now ? deps.now() : new Date().toISOString(), 'binder_download', JSON.stringify({ binder_id: id, source_page: from })).run();
      headers.set('X-Binder-Counted', '1');
    } catch (_) {
      // A metrics outage must not take away the free PDF, and must be visible.
      console.error('NAMED STOP [BINDER_COUNT_UNAVAILABLE] Download served; event storage failed');
      headers.set('X-Binder-Counted', '0');
    }
  }
  return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers });
}
export async function binderCounts(db, since) {
  const result = await db.prepare("SELECT json_extract(detail, '$.binder_id') binder_id, json_extract(detail, '$.source_page') source_page, COUNT(*) downloads FROM seat_events WHERE event = 'binder_download' AND at >= ? GROUP BY binder_id, source_page ORDER BY downloads DESC").bind(since).all();
  return result.results.map((r) => ({ binder_id: r.binder_id, source_page: r.source_page, downloads: Number(r.downloads) }));
}
