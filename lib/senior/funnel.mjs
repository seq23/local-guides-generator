/**
 * Funnel: anonymous wizard events in, PII-free counts out.
 *   POST /api/senior-event   {session, event, screen, page_kind, page_slug, src}  (from the wizard)
 *   GET  /api/senior-funnel?days=7   header x-senior-tick-token (same secret as the tick)
 * Screen numbers: family flow 1-11 (who, zip, adl, dementia, wanders, budget, payer, timeline,
 * tags, results, contact), off-ramp 12, off-ramp done 13, thanks 14; planner flow 21-26.
 * The response is built from an explicit list of counts; no row is ever echoed back.
 */
import { clip, json } from './util.mjs';

export const FUNNEL_EVENTS = ['screen', 'intake_start', 'results_shown'];
const MAX_DAYS = 366;

export async function recordEvent(env, body, now) {
  const session = String(body.session || '');
  if (!/^[0-9a-f]{16,32}$/.test(session)) return { ok: false, error: 'session' };
  if (!FUNNEL_EVENTS.includes(body.event)) return { ok: false, error: 'event' };
  const screen = Number(body.screen || 0);
  if (!Number.isInteger(screen) || screen < 0 || screen > 99) return { ok: false, error: 'screen' };
  await env.SENIOR_DB.prepare('INSERT OR IGNORE INTO funnel_events (at, session, event, screen, page_kind, page_slug, src) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(now, session, body.event, screen, clip(body.page_kind, 32), clip(body.page_slug, 160), clip(body.src, 120)).run();
  return { ok: true };
}

async function rows(db, sql, ...args) {
  return (await db.prepare(sql).bind(...args).all()).results;
}
async function one(db, sql, ...args) {
  const r = await db.prepare(sql).bind(...args).first();
  return Number((r && r.n) || 0);
}
const toMap = (list, key) => Object.fromEntries(list.map((r) => [r[key] == null || r[key] === '' ? '(none)' : String(r[key]), Number(r.n)]));

export async function funnel(env, seat, nowIso, days) {
  const db = env.SENIOR_DB;
  const since = new Date(Date.parse(nowIso) - days * 86400000).toISOString();
  const outcomes = toMap(await rows(db, 'SELECT answer, COUNT(*) n FROM followups WHERE answered_at >= ? GROUP BY answer', since), 'answer');
  return {
    window: { days, since, until: nowIso },
    intake_starts: await one(db, "SELECT COUNT(DISTINCT session) n FROM funnel_events WHERE event = 'intake_start' AND at >= ?", since),
    results_shown: await one(db, "SELECT COUNT(DISTINCT session) n FROM funnel_events WHERE event = 'results_shown' AND at >= ?", since),
    screens: toMap(await rows(db, "SELECT screen, COUNT(DISTINCT session) n FROM funnel_events WHERE event = 'screen' AND at >= ? GROUP BY screen ORDER BY screen", since), 'screen'),
    contact_submitted: await one(db, 'SELECT COUNT(*) n FROM leads WHERE created_at >= ?', since),
    unsellable: await one(db, "SELECT COUNT(*) n FROM leads WHERE status = 'unsellable' AND created_at >= ?", since),
    unsellable_reasons: toMap(await rows(db, "SELECT unsellable_reason, COUNT(*) n FROM leads WHERE status = 'unsellable' AND created_at >= ? GROUP BY unsellable_reason", since), 'unsellable_reason'),
    teasers_sent: await one(db, 'SELECT COUNT(*) n FROM teasers WHERE sent_at >= ?', since),
    accepts_flat: await one(db, "SELECT COUNT(*) n FROM accepts WHERE option = 'flat' AND status = 'released' AND accepted_at >= ?", since),
    accepts_rent: await one(db, "SELECT COUNT(*) n FROM accepts WHERE option = 'rent' AND status = 'released' AND accepted_at >= ?", since),
    accepts_late: await one(db, "SELECT COUNT(*) n FROM accepts WHERE status = 'late' AND accepted_at >= ?", since),
    releases: await one(db, 'SELECT COUNT(*) n FROM accepts WHERE released_at >= ?', since),
    passes: toMap(await rows(db, "SELECT event, COUNT(*) n FROM seat_events WHERE event IN ('pass', 'timed_pass', 'not_placed') AND at >= ? GROUP BY event", since), 'event'),
    followup_outcomes: { moved_in: outcomes.moved_in || 0, not_yet: outcomes.not_yet || 0, elsewhere: outcomes.elsewhere || 0 },
    seat: { active: Boolean(seat && seat.active === true), end: seat && seat.active === true ? seat.end || null : null },
    leads_by_page: (await rows(db, 'SELECT page_kind, page_slug, COUNT(*) n FROM leads WHERE created_at >= ? GROUP BY page_kind, page_slug ORDER BY n DESC LIMIT 500', since))
      .map((r) => ({ page_kind: r.page_kind || '', page_slug: r.page_slug || '', leads: Number(r.n) })),
    leads_by_src: toMap(await rows(db, 'SELECT src, COUNT(*) n FROM leads WHERE created_at >= ? GROUP BY src ORDER BY n DESC LIMIT 200', since), 'src')
  };
}

export async function handleEvent(context, deps) {
  const env = context.env || {};
  if (!env.SENIOR_DB) return json({ ok: false, error: 'not_found' }, 404);
  const b = await context.request.json().catch(() => ({}));
  const r = await recordEvent(env, b || {}, deps.now ? deps.now() : new Date().toISOString());
  return json(r, r.ok ? 200 : 400);
}

export async function handleFunnel(context, deps) {
  const env = context.env || {};
  if (!env.SENIOR_DB) return json({ ok: false, error: 'not_found' }, 404);
  const expected = String(env.SENIOR_TICK_TOKEN || '');
  if (!expected || String(context.request.headers.get('x-senior-tick-token') || '') !== expected) return json({ ok: false, error: 'unauthorized' }, 401);
  const d = Number(new URL(context.request.url).searchParams.get('days') || 7);
  const days = Number.isFinite(d) && d > 0 ? Math.min(Math.floor(d), MAX_DAYS) : 7;
  return json({ ok: true, ...(await funnel(env, deps.seat, deps.now ? deps.now() : new Date().toISOString(), days)) });
}
