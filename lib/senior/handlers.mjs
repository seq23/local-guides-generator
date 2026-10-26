/**
 * HTTP handlers for the senior lead endpoints. functions/api/senior-*.js are thin
 * wrappers that pass the bundled seat config and zip table in `deps`; tests pass fakes.
 *
 * Every link in an email lands on a GET page with ONE confirm button (a POST): mail
 * scanners pre-fetch links, and a prefetch must never accept a lead, pass a seat,
 * record a move-in or unsubscribe anyone.
 */
import M from '../../assets/senior-match.js';
import { parseLead } from './lead.mjs';
import * as F from './flows.mjs';
import { verifyStripeSignature, stripe, priceId, SEAT_LOOKUP_KEY, SEAT_TRIAL_DAYS } from './stripe.mjs';
import { BRAND, esc, html, json, log, origin } from './util.mjs';
import { mirrorToAirtable } from './airtable.mjs';
import { blockedDomainFor, logBlockedLead } from '../blocked_lead_domains.mjs';

export const FACILITIES_PATH = '/data/facilities.json';

async function loadFacilities(context) {
  const env = context.env || {};
  try {
    const url = new URL(FACILITIES_PATH, context.request.url);
    const res = env.ASSETS ? await env.ASSETS.fetch(new Request(url.toString())) : await fetch(url.toString());
    if (!res.ok) throw new Error(`status ${res.status}`);
    return M.facilityList(await res.json());
  } catch (e) {
    log('error', 'facilities unavailable', String(e.message || e));
    return [];
  }
}

export async function makeCtx(context, deps) {
  const env = context.env || {};
  const facilities = deps.facilities ? M.facilityList(deps.facilities) : await loadFacilities(context);
  return { env, now: deps.now ? deps.now() : new Date().toISOString(), facilities, zips: deps.zips || {}, seat: deps.seat || { active: false }, origin: origin(env) };
}

function notHere(env) {
  return !env || !env.SENIOR_DB;
}

export function page(title, bodyHtml, status = 200) {
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} | ${BRAND}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f7f5f0;color:#1f2a2e}main{max-width:560px;margin:0 auto;padding:32px 16px}h1{font-size:1.4rem}button{font:inherit;font-size:1.05rem;padding:14px 20px;border:0;border-radius:10px;background:#1f5c4a;color:#fff;width:100%;cursor:pointer}select,textarea{font:inherit;width:100%;padding:10px;margin:8px 0 16px;box-sizing:border-box}.muted{color:#5b6669;font-size:.9rem}</style></head>
<body><main><p class="muted">${BRAND}</p><h1>${esc(title)}</h1>${bodyHtml}<p class="muted">${BRAND} is a property of The Industry Guides · hello@theindustryguides.com</p></main></body></html>`, status);
}

function confirmForm(action, label, extra = '') {
  return `<form method="post" action="${esc(action)}">${extra}<button type="submit">${esc(label)}</button></form>`;
}

async function body(request) {
  const ct = String(request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return request.json().catch(() => ({}));
  if (ct.includes('form')) {
    const fd = await request.formData().catch(() => null);
    const o = {};
    if (fd) for (const [k, v] of fd.entries()) o[k] = v;
    return o;
  }
  return {};
}

/* POST /api/senior-lead */
export async function handleLead(context, deps) {
  const env = context.env || {};
  if (notHere(env)) return json({ ok: false, error: 'not_found' }, 404);
  try {
    const req = context.request;
    if (!String(req.headers.get('content-type') || '').toLowerCase().includes('application/json')) return json({ ok: false, error: 'content_type' }, 415);
    const b = await req.json().catch(() => ({}));
    const p = parseLead(b);
    if (p.bot) return json({ ok: true });
    if (p.error) return json({ ok: false, error: p.error }, 400);
    const blocked = blockedDomainFor(p.lead.email, env.BLOCKED_LEAD_DOMAINS);
    if (blocked) {
      logBlockedLead(blocked, (() => { try { return new URL(req.url).host; } catch (_) { return ''; } })());
      return json({ ok: true });
    }
    const ctx = await makeCtx(context, deps);
    if (b.lead_id && b.edit_token) {
      const updated = await F.addOffRampContact(ctx, String(b.lead_id), String(b.edit_token), p.lead);
      return updated ? json({ ok: true, lead_id: updated.id, status: updated.status }) : json({ ok: false, error: 'lead' }, 400);
    }
    const host = (() => { try { return new URL(req.url).host; } catch (_) { return ''; } })();
    const lead = await F.createLead(ctx, p.lead, { host });
    const mirror = mirrorToAirtable(env, lead).catch((e) => log('error', 'airtable mirror', String(e.message || e)));
    if (context.waitUntil) context.waitUntil(mirror); else await mirror;
    const out = { ok: true, lead_id: lead.id, status: lead.status, storage: 'd1' };
    if (lead.status === 'unsellable') { out.unsellable_reason = lead.unsellable_reason; out.edit_token = lead.edit_token; }
    return json(out);
  } catch (e) {
    log('error', 'lead failed', String(e.message || e));
    return json({ ok: false, error: 'server_error' }, 500);
  }
}

/* GET|POST /api/senior-accept?t=&o=flat|rent[&paid=cs_...] */
export async function handleAccept(context, deps) {
  const env = context.env || {};
  if (notHere(env)) return new Response('Not found', { status: 404 });
  const url = new URL(context.request.url);
  const t = url.searchParams.get('t') || '';
  const o = url.searchParams.get('o') === 'flat' ? 'flat' : 'rent';
  const ctx = await makeCtx(context, deps);
  const tz = await F.teaserByToken(env.SENIOR_DB, t);
  if (!tz) return page('Link not recognised', '<p>This link is not valid. Reply to the email and we will help.</p>', 404);
  const taken = () => page('This lead has been taken', `<p>Five communities have already accepted this family, so the details have been released to them. Your click is recorded. Thank you for answering quickly; the next family may be yours.</p>`);
  const already = () => page('You already have this family', '<p>The family\'s details were emailed to you when you accepted. Check your inbox for "Family lead details".</p>');
  try {
    if (context.request.method === 'GET') {
      const paid = url.searchParams.get('paid');
      if (paid && o === 'flat') {
        const session = await stripe(env, 'GET', `checkout/sessions/${encodeURIComponent(paid)}`);
        if ((session.metadata || {}).teaser_token !== tz.token) return page('Link not recognised', '<p>This payment does not belong to this lead.</p>', 400);
        const r = await F.releaseFlat(ctx, session);
        if (r.state === 'released') return page('Payment received', '<p>Thank you. The family\'s full details are on their way to your inbox now.</p>');
        if (r.state === 'already') return already();
        if (r.state === 'taken') return page('This lead has been taken', '<p>Five communities accepted before your payment completed. Your payment has been refunded in full.</p>');
        return page('Payment pending', '<p>Your payment has not completed yet. If it does, the details will be emailed to you automatically.</p>');
      }
      if ((await F.releasedCount(env.SENIOR_DB, tz.lead_id)) >= M.MAX_ACCEPTS) {
        const mine = await env.SENIOR_DB.prepare("SELECT 1 FROM accepts WHERE lead_id = ? AND facility_id = ? AND status = 'released'").bind(tz.lead_id, tz.facility_id).first();
        return mine ? already() : page('This lead has been taken', '<p>Five communities have already accepted this family. Thank you for answering quickly; the next family may be yours.</p>');
      }
      const terms = o === 'flat'
        ? '<p>You pay a one-time $800 referral fee by card now. The family\'s name, phone and email are emailed to you as soon as payment completes.</p>'
        : '<p>You agree to pay The Industry Guides a referral fee equal to one month\'s rent for this resident if they move in to your community. The family\'s name, phone and email are emailed to you as soon as you accept.</p>';
      return page(o === 'flat' ? 'Pay $800 for this family' : 'Accept: one month\'s rent on move-in', `${terms}<p class="muted">Up to five communities receive each family. Your acceptance is time-stamped.</p>${confirmForm(url.pathname + url.search, o === 'flat' ? 'Continue to payment' : 'Accept and send me the details')}`);
    }
    if (o === 'flat') {
      const r = await F.startFlatCheckout(ctx, t);
      if (r.state === 'checkout') return Response.redirect(r.url, 303);
      return r.state === 'already' ? already() : taken();
    }
    const r = await F.acceptRent(ctx, t);
    if (r.state === 'released') return page('Accepted', '<p>Thank you. The family\'s full details are on their way to your inbox now, with the terms you accepted and the time stamp.</p>');
    return r.state === 'already' ? already() : taken();
  } catch (e) {
    log('error', 'accept failed', String(e.message || e));
    return page('Something went wrong', '<p>Please try the link again in a minute, or reply to the email.</p>', 500);
  }
}

/* GET|POST /api/senior-seat?t=&a=working|pass */
export async function handleSeat(context, deps) {
  const env = context.env || {};
  if (notHere(env)) return new Response('Not found', { status: 404 });
  const url = new URL(context.request.url);
  const t = url.searchParams.get('t') || '';
  const a = url.searchParams.get('a') === 'pass' ? 'pass' : 'working';
  if (context.request.method === 'GET') {
    const ev = await env.SENIOR_DB.prepare("SELECT 1 FROM seat_events WHERE token = ? AND event = 'offered'").bind(t).first();
    if (!ev) return page('Link not recognised', '<p>This link is not valid.</p>', 404);
    if (a === 'working') return page('Working this family', '<p>Confirm you are working this family. We will check in with them at day 30.</p>' + confirmForm(url.pathname + url.search, 'Yes, we are working it'));
    const why = '<label>Why are you passing?<select name="why"><option>No availability</option><option>Care needs do not fit</option><option>Budget does not fit</option><option>Could not reach the family</option><option>Other</option></select></label>';
    return page('Pass on this family', '<p>The family will be offered to other communities right away.</p>' + confirmForm(url.pathname + url.search, 'Pass', why));
  }
  const b = await body(context.request);
  const ctx = await makeCtx(context, deps);
  const r = await F.seatAction(ctx, t, a, String(b.why || '').slice(0, 80));
  if (r.state === 'unknown') return page('Link not recognised', '<p>This link is not valid.</p>', 404);
  if (!r.ok) return page('Already released', `<p>This family was already released to other communities (${esc(r.lead && r.lead.open_round_at || '')}).</p>`);
  return a === 'working' ? page('Recorded: working it', '<p>Thank you. The family is yours to work.</p>') : page('Recorded: pass', '<p>Thank you. The family is being offered to other communities.</p>');
}

/* GET|POST /api/senior-followup?t=&a=&f= */
export async function handleFollowup(context, deps) {
  const env = context.env || {};
  if (notHere(env)) return new Response('Not found', { status: 404 });
  const url = new URL(context.request.url);
  const t = url.searchParams.get('t') || '';
  const a = url.searchParams.get('a') || '';
  const f = url.searchParams.get('f') || '';
  const ctx = await makeCtx(context, deps);
  if (context.request.method === 'GET') {
    const fu = await env.SENIOR_DB.prepare('SELECT 1 FROM followups WHERE token = ?').bind(t).first();
    if (!fu) return page('Link not recognised', '<p>This link is not valid.</p>', 404);
    const fac = ctx.facilities.find((x) => x.id === f);
    const label = a === 'moved_in' ? `We chose ${fac ? fac.name : 'this community'}` : a === 'elsewhere' ? 'We chose somewhere else' : 'Not yet';
    return page('Thank you for letting us know', `<p>Your answer: <strong>${esc(label)}</strong></p>${confirmForm(url.pathname + url.search, 'Confirm')}`);
  }
  const r = await F.answerFollowup(ctx, t, a, f);
  if (r.state !== 'recorded') return page('Link not recognised', '<p>This link is not valid.</p>', 404);
  return page('Thank you', r.answer === 'not_yet' ? '<p>Thank you. We will check in again later. If you need help, reply to our email.</p>' : '<p>Thank you, and we wish your family well.</p>');
}

/* GET|POST /api/senior-unsubscribe?t= (POST also serves List-Unsubscribe-Post one-click) */
export async function handleUnsubscribe(context) {
  const env = context.env || {};
  if (notHere(env)) return new Response('Not found', { status: 404 });
  const url = new URL(context.request.url);
  const t = url.searchParams.get('t') || '';
  const row = await env.SENIOR_DB.prepare('SELECT email, unsubscribed_at FROM recipients WHERE token = ?').bind(t).first();
  if (!row) return page('Link not recognised', '<p>This unsubscribe link is not valid. Email hello@theindustryguides.com and we will remove you.</p>', 404);
  if (context.request.method === 'GET') {
    if (row.unsubscribed_at) return page('You are unsubscribed', '<p>You will not receive these emails again.</p>');
    return page('Unsubscribe', '<p>Stop all emails from Memphis Senior Care Homes to this address?</p>' + confirmForm(url.pathname + url.search, 'Unsubscribe'));
  }
  await env.SENIOR_DB.prepare('UPDATE recipients SET unsubscribed_at = COALESCE(unsubscribed_at, ?) WHERE token = ?').bind(new Date().toISOString(), t).run();
  return page('You are unsubscribed', '<p>You will not receive these emails again.</p>');
}

/* POST /api/senior-stripe-webhook */
export async function handleWebhook(context, deps) {
  const env = context.env || {};
  if (notHere(env)) return json({ ok: false, error: 'not_found' }, 404);
  const raw = await context.request.text();
  const v = await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, context.request.headers.get('stripe-signature'), raw, deps.nowSeconds ? deps.nowSeconds() : undefined);
  if (!v.ok) {
    log('error', 'webhook rejected', v.reason);
    return json({ ok: false, error: v.reason }, 400);
  }
  let event;
  try { event = JSON.parse(raw); } catch (_) { return json({ ok: false, error: 'json' }, 400); }
  if (event.type !== 'checkout.session.completed') return json({ ok: true, ignored: event.type });
  const session = event.data && event.data.object;
  const ctx = await makeCtx(context, deps);
  try {
    const kind = (session.metadata || {}).kind;
    const r = kind === 'senior_seat' ? await F.seatCheckoutCompleted(ctx, session) : await F.releaseFlat(ctx, session);
    return json({ ok: true, ...r });
  } catch (e) {
    log('error', 'webhook handling failed', String(e.message || e));
    return json({ ok: false, error: 'server_error' }, 500); // Stripe retries
  }
}

/* POST /api/senior-seat-checkout {facility_id, email?} -> {url} */
export async function handleSeatCheckout(context, deps) {
  const env = context.env || {};
  if (notHere(env)) return json({ ok: false, error: 'not_found' }, 404);
  const b = await body(context.request);
  const ctx = await makeCtx(context, deps);
  const f = ctx.facilities.find((x) => x.id === String(b.facility_id || ''));
  if (!f) return json({ ok: false, error: 'facility_id' }, 400);
  try {
    const price = await priceId(env, SEAT_LOOKUP_KEY);
    const md = { kind: 'senior_seat', facility_id: f.id };
    const session = await stripe(env, 'POST', 'checkout/sessions', {
      mode: 'subscription',
      line_items: { 0: { price, quantity: 1 } },
      customer_email: String(b.email || f.email || '') || undefined,
      client_reference_id: f.id,
      metadata: md,
      subscription_data: { trial_period_days: SEAT_TRIAL_DAYS, metadata: md, description: `Exclusive lead routing - Memphis - ${f.name}` },
      success_url: `${ctx.origin}/for-providers/?seat=thanks`,
      cancel_url: `${ctx.origin}/for-providers/`
    });
    return json({ ok: true, url: session.url, id: session.id });
  } catch (e) {
    log('error', 'seat checkout failed', String(e.message || e));
    return json({ ok: false, error: 'stripe' }, 502);
  }
}

/* POST /api/senior-tick (GitHub Actions cron, every 15 minutes) */
export async function handleTick(context, deps) {
  const env = context.env || {};
  if (notHere(env)) return json({ ok: false, error: 'not_found' }, 404);
  const expected = String(env.SENIOR_TICK_TOKEN || '');
  const got = String(context.request.headers.get('x-senior-tick-token') || '');
  if (!expected || got !== expected) return json({ ok: false, error: 'unauthorized' }, 401);
  const ctx = await makeCtx(context, deps);
  const r = await F.tick(ctx);
  return json({ ok: true, at: ctx.now, facilities: ctx.facilities.length, ...r });
}
