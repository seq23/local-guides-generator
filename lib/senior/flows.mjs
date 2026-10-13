/**
 * The senior lead state machine. Every transition writes a timestamped row (teasers,
 * accepts, seat_events, followups, sends): together they are the invoice evidence.
 *
 *   new lead ── off-ramp (tier 3 / Medicaid-only) ──> unsellable, owner emailed
 *            ── seat active and fits ──> seat_offered ── "Working it" ──> seat_working
 *                                             │                 └─ day-30 "not yet" ─┐
 *                                             ├─ "Pass" ──────────────────────────────┤
 *                                             └─ 72 h no click (tick) ────────────────┤
 *            ── otherwise ───────────────────────────────────────────────> OPEN ROUND
 *   open round: a PII-free teaser to every fitting community with an email; the first
 *   five accepts (pay $800 now, or one month's rent on move-in) get the full lead;
 *   later accepts are recorded `late` (and refunded if they paid).
 *
 * ctx = { env, now, facilities (normalized), zips, seat, origin }
 */
import M from '../../assets/senior-match.js';
import { sendEmail } from './email.mjs';
import { attributionText, fullLeadText, teaserText, teaserFields } from './lead.mjs';
import { addDays, addHours, leadId, log, parseList, token, BRAND } from './util.mjs';
import { FLAT_LOOKUP_KEY, priceId, stripe, SEAT_TERM_MONTHS } from './stripe.mjs';

export const RELEASE_HOURS = 72;
export const FOLLOWUP_DAYS = [30, 60, 90];
export const MAX_TEASER_ATTEMPTS = 5;
export const TICK_BATCH = 50;

const ownerTo = (env) => String(env.LEAD_TO || '').trim();

export function seatIsActive(seat, nowIso) {
  if (!seat || seat.active !== true || !seat.facility_id) return false;
  const today = String(nowIso).slice(0, 10);
  return (!seat.start || seat.start <= today) && (!seat.end || today <= seat.end);
}

function matchLead(row) {
  return { ...row, payers: parseList(row.payers), care_tier: Number(row.care_tier), memory_care: Number(row.memory_care) };
}

export async function getLead(db, id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
}

function facility(ctx, id) {
  return ctx.facilities.find((f) => f.id === id) || null;
}

async function notifyOwner(ctx, lead, subject, text) {
  return sendEmail(ctx.env, {
    to: ownerTo(ctx.env), subject, text, kind: 'owner_notice', leadId: lead ? lead.id : null, transactional: true, now: ctx.now,
    why: `You are receiving this because ${ownerTo(ctx.env) || 'this address'} is the lead inbox for ${BRAND}.`
  });
}

/* ---------------------------------------------------------------- create */

export async function createLead(ctx, parsed, meta = {}) {
  const db = ctx.env.SENIOR_DB;
  const id = leadId();
  const unsellable = Boolean(parsed.unsellable_reason);
  const row = {
    id, created_at: ctx.now, kind: parsed.kind, who_for: parsed.who_for, zip: parsed.zip, radius: parsed.radius,
    care_tier: parsed.care_tier, adl_tasks: JSON.stringify(parsed.adl_tasks || []), memory_care: parsed.memory_care,
    dementia: parsed.dementia, wanders: parsed.wanders, budget_band: parsed.budget_band, payers: JSON.stringify(parsed.payers || []),
    timeline: parsed.timeline, discharge_date: parsed.discharge_date, tags: JSON.stringify(parsed.tags || []),
    name: parsed.name, phone: parsed.phone, email: parsed.email, senior_first_name: parsed.senior_first_name,
    consent_contact: parsed.consent_contact, consent_health: parsed.consent_health,
    status: unsellable ? 'unsellable' : 'new', unsellable_reason: parsed.unsellable_reason || null,
    shown_ids: JSON.stringify(parsed.shown_ids || []), source_domain: meta.host || '',
    src: parsed.src, intent_type: parsed.intent_type, button_source: parsed.button_source, vertical_key: parsed.vertical_key,
    page_kind: parsed.page_kind, page_slug: parsed.page_slug, market_slug: parsed.market_slug,
    edit_token: unsellable ? token(12) : null
  };
  const cols = Object.keys(row);
  await db.prepare(`INSERT INTO leads (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...cols.map((c) => row[c] ?? null)).run();
  const lead = await getLead(db, id);

  let routing;
  if (unsellable) {
    routing = `Off-ramp: stored as UNSELLABLE (${lead.unsellable_reason}). The family was shown the Tennessee resources screen. Nothing was sent to any community.`;
  } else {
    if (lead.email) await scheduleFollowups(ctx, lead);
    const seat = ctx.seat;
    const holder = seatIsActive(seat, ctx.now) ? facility(ctx, seat.facility_id) : null;
    if (holder && holder.email && M.fits(holder, matchLead(lead))) {
      await offerSeat(ctx, lead, holder);
      routing = `Seat route: sent in full to the seat holder ${holder.name} (${holder.id}). The open round starts if they pass or do not click within ${RELEASE_HOURS} hours (${addHours(ctx.now, RELEASE_HOURS)}).`;
    } else {
      const n = await openRound(ctx, lead, { exclude: [], reason: holder ? 'seat holder does not fit this lead' : 'no active seat' });
      routing = `Open round: teaser queued to ${n} fitting ${n === 1 ? 'community' : 'communities'}${holder ? ' (the seat holder does not fit this lead)' : ''}.`;
    }
  }
  const fresh = await getLead(db, id);
  const subject = unsellable
    ? `Senior lead (unsellable: ${fresh.unsellable_reason}) - ${fresh.id}`
    : `Senior lead - tier ${fresh.care_tier}${Number(fresh.memory_care) ? ' memory care' : ''} - ${fresh.id}`;
  await notifyOwner(ctx, fresh, subject, `${routing}\n\n${fullLeadText(fresh)}\n\n${attributionText(fresh)}\n\nThis lead is stored in D1 (senior-leads). Status: ${fresh.status}.`);
  return fresh;
}

/** Contact details added to an off-ramp lead from the resources screen. */
export async function addOffRampContact(ctx, leadIdValue, editToken, parsed) {
  const db = ctx.env.SENIOR_DB;
  const lead = await getLead(db, leadIdValue);
  if (!lead || lead.status !== 'unsellable' || !lead.edit_token || lead.edit_token !== editToken) return null;
  await db.prepare('UPDATE leads SET name = ?, phone = ?, email = ?, senior_first_name = ?, consent_contact = ? WHERE id = ?')
    .bind(parsed.name || lead.name, parsed.phone || lead.phone, parsed.email || lead.email, parsed.senior_first_name || lead.senior_first_name, parsed.consent_contact, lead.id).run();
  const fresh = await getLead(db, lead.id);
  await notifyOwner(ctx, fresh, `Senior lead (unsellable: ${fresh.unsellable_reason}) - contact added - ${fresh.id}`,
    `The family on the off-ramp left contact details and asked for a call.\n\n${fullLeadText(fresh)}`);
  return fresh;
}

/* ---------------------------------------------------------------- seat */

export async function offerSeat(ctx, lead, holder) {
  const db = ctx.env.SENIOR_DB;
  const t = token();
  await db.batch([
    db.prepare('INSERT INTO seat_events (at, event, facility_id, lead_id, token) VALUES (?, ?, ?, ?, ?)').bind(ctx.now, 'offered', holder.id, lead.id, t),
    db.prepare("UPDATE leads SET status = 'seat_offered', seat_facility_id = ?, seat_offered_at = ? WHERE id = ?").bind(holder.id, ctx.now, lead.id)
  ]);
  const text = [
    `New family lead for ${holder.name}, sent to you alone under your exclusive Memphis routing.`,
    '',
    fullLeadText(lead),
    '',
    `Working it: ${ctx.origin}/api/senior-seat?t=${t}&a=working`,
    `Pass: ${ctx.origin}/api/senior-seat?t=${t}&a=pass`,
    '',
    `If neither link is used within ${RELEASE_HOURS} hours, the lead is released to other communities.`
  ].join('\n');
  return sendEmail(ctx.env, { to: holder.email, subject: `New family lead - ${lead.id}`, text, kind: 'seat_offer', leadId: lead.id, facilityId: holder.id, transactional: true, now: ctx.now,
    why: `You are receiving this because ${holder.name} holds the exclusive lead routing seat on ${BRAND}.` });
}

export async function seatAction(ctx, t, action, why = '') {
  const db = ctx.env.SENIOR_DB;
  const ev = await db.prepare("SELECT * FROM seat_events WHERE token = ? AND event = 'offered'").bind(t).first();
  if (!ev) return { ok: false, state: 'unknown' };
  const lead = await getLead(db, ev.lead_id);
  if (lead.status !== 'seat_offered' && !(action === 'pass' && lead.status === 'seat_working')) {
    return { ok: false, state: lead.status, lead };
  }
  if (action === 'working') {
    if (lead.status === 'seat_working') return { ok: true, state: 'seat_working', lead };
    await db.batch([
      db.prepare('INSERT INTO seat_events (at, event, facility_id, lead_id) VALUES (?, ?, ?, ?)').bind(ctx.now, 'working', ev.facility_id, lead.id),
      db.prepare("UPDATE leads SET status = 'seat_working' WHERE id = ? AND status = 'seat_offered'").bind(lead.id)
    ]);
    return { ok: true, state: 'seat_working', lead };
  }
  await passToOpenRound(ctx, lead, 'pass', why || 'passed (no reason given)');
  return { ok: true, state: 'open_round', lead };
}

/** Pass, timed pass, or not placed by day 30: the seat holder's turn ends and the open round starts. */
export async function passToOpenRound(ctx, lead, event, why) {
  const db = ctx.env.SENIOR_DB;
  const claimed = await db.prepare("UPDATE leads SET status = 'open_round', open_round_at = ? WHERE id = ? AND status IN ('seat_offered', 'seat_working')").bind(ctx.now, lead.id).run();
  if (!claimed.meta || !claimed.meta.changes) return 0;
  await db.prepare('INSERT INTO seat_events (at, event, facility_id, lead_id, detail) VALUES (?, ?, ?, ?, ?)').bind(ctx.now, event, lead.seat_facility_id, lead.id, why).run();
  const n = await openRound(ctx, lead, { exclude: [lead.seat_facility_id], reason: event });
  const holder = facility(ctx, lead.seat_facility_id);
  const fresh = await getLead(db, lead.id);
  await notifyOwner(ctx, fresh, `Seat ${event.replace('_', ' ')} - ${fresh.id} released to the open round`, [
    `Who passed: ${holder ? `${holder.name} (${holder.id})` : lead.seat_facility_id}`,
    `How: ${event === 'timed_pass' ? `no click within ${RELEASE_HOURS} hours` : event === 'not_placed' ? 'working it, but the family reported not placed at the day-30 follow-up' : 'clicked Pass'}`,
    `Why: ${why}`,
    `Open round sent: ${fresh.open_round_at} to ${n} fitting ${n === 1 ? 'community' : 'communities'}`,
    '',
    'Lead summary (teaser fields):',
    ...Object.entries(teaserFields(fresh)).map(([k, v]) => `  ${k}: ${v}`)
  ].join('\n'));
  return n;
}

/* ---------------------------------------------------------------- open round */

export async function openRound(ctx, lead, { exclude = [] } = {}) {
  const db = ctx.env.SENIOR_DB;
  const already = (await db.prepare('SELECT facility_id FROM teasers WHERE lead_id = ?').bind(lead.id).all()).results.map((r) => r.facility_id);
  const targets = M.openRoundTargets(ctx.facilities, matchLead(lead), ctx.zips, exclude.filter(Boolean).concat(already));
  const stmts = targets.map((f) => db.prepare('INSERT OR IGNORE INTO teasers (lead_id, facility_id, facility_email, created_at, token) VALUES (?, ?, ?, ?, ?)')
    .bind(lead.id, f.id, f.email, ctx.now, token()));
  stmts.push(db.prepare("UPDATE leads SET status = 'open_round', open_round_at = COALESCE(open_round_at, ?) WHERE id = ? AND status != 'unsellable'").bind(ctx.now, lead.id));
  await db.batch(stmts);
  if (!targets.length) {
    log('info', 'open round has no target', lead.id);
  }
  await sendQueuedTeasers(ctx, lead.id);
  return targets.length;
}

export async function releasedCount(db, id) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM accepts WHERE lead_id = ? AND status = 'released'").bind(id).first();
  return Number(r.n || 0);
}

export async function sendQueuedTeasers(ctx, onlyLeadId = null) {
  const db = ctx.env.SENIOR_DB;
  const q = onlyLeadId
    ? db.prepare('SELECT * FROM teasers WHERE sent_at IS NULL AND attempts < ? AND lead_id = ? ORDER BY id LIMIT ?').bind(MAX_TEASER_ATTEMPTS, onlyLeadId, 500)
    : db.prepare('SELECT * FROM teasers WHERE sent_at IS NULL AND attempts < ? ORDER BY id LIMIT ?').bind(MAX_TEASER_ATTEMPTS, TICK_BATCH);
  const rows = (await q.all()).results;
  let sent = 0;
  const leads = new Map();
  for (const tz of rows) {
    if (!leads.has(tz.lead_id)) leads.set(tz.lead_id, await getLead(db, tz.lead_id));
    const lead = leads.get(tz.lead_id);
    if ((await releasedCount(db, lead.id)) >= M.MAX_ACCEPTS) {
      await db.prepare("UPDATE teasers SET attempts = ?, send_error = 'lead_taken_before_send' WHERE id = ?").bind(MAX_TEASER_ATTEMPTS, tz.id).run();
      continue;
    }
    const links = {
      flat: `${ctx.origin}/api/senior-accept?t=${tz.token}&o=flat`,
      rent: `${ctx.origin}/api/senior-accept?t=${tz.token}&o=rent`
    };
    const f = facility(ctx, tz.facility_id);
    const r = await sendEmail(ctx.env, {
      to: tz.facility_email, subject: `Family looking for senior living - ${teaserFields(lead).area}`, text: teaserText(lead, links),
      kind: 'teaser', leadId: lead.id, facilityId: tz.facility_id, now: ctx.now,
      why: `You are receiving this because ${f ? f.name : 'your community'} is publicly listed as a senior living community in the Memphis area.`
    });
    if (r.ok) {
      sent += 1;
      await db.prepare('UPDATE teasers SET sent_at = ?, attempts = attempts + 1, send_error = NULL WHERE id = ?').bind(ctx.now, tz.id).run();
    } else {
      const final = r.reason === 'unsubscribed' ? MAX_TEASER_ATTEMPTS : null;
      await db.prepare('UPDATE teasers SET attempts = COALESCE(?, attempts + 1), send_error = ? WHERE id = ?').bind(final, r.reason, tz.id).run();
    }
  }
  return sent;
}

/* ---------------------------------------------------------------- accept + release */

export async function teaserByToken(db, t) {
  return db.prepare('SELECT * FROM teasers WHERE token = ?').bind(String(t || '')).first();
}

function termsLine(option, at, sessionId) {
  return option === 'flat'
    ? `Terms accepted ${at}: $800 flat referral fee, paid by card through Stripe (session ${sessionId}).`
    : `Terms accepted ${at}: a referral fee equal to one month's rent for this resident, invoiced by The Industry Guides when the resident moves in.`;
}

async function recordLate(ctx, tz, option, sessionId = null) {
  await ctx.env.SENIOR_DB.prepare("INSERT INTO accepts (lead_id, facility_id, option, accepted_at, status, stripe_session_id) VALUES (?, ?, ?, ?, 'late', ?)")
    .bind(tz.lead_id, tz.facility_id, option, ctx.now, sessionId).run();
}

/**
 * Atomically claim one of the five release slots. Returns 'released', 'already' (this
 * facility already has the details) or 'taken' (five communities already have them).
 */
async function claimSlot(ctx, tz, option, sessionId) {
  const db = ctx.env.SENIOR_DB;
  const existing = await db.prepare("SELECT * FROM accepts WHERE lead_id = ? AND facility_id = ? AND status = 'released'").bind(tz.lead_id, tz.facility_id).first();
  if (existing) return { state: 'already', row: existing };
  const terms = termsLine(option, ctx.now, sessionId);
  const r = await db.prepare(
    "INSERT INTO accepts (lead_id, facility_id, option, accepted_at, status, stripe_session_id, released_at, terms) " +
    "SELECT ?, ?, ?, ?, 'released', ?, ?, ? WHERE (SELECT COUNT(*) FROM accepts WHERE lead_id = ? AND status = 'released') < ?"
  ).bind(tz.lead_id, tz.facility_id, option, ctx.now, sessionId, ctx.now, terms, tz.lead_id, M.MAX_ACCEPTS).run();
  if (r.meta && r.meta.changes) return { state: 'released', terms };
  return { state: 'taken' };
}

async function releaseEmail(ctx, tz, option, terms) {
  const lead = await getLead(ctx.env.SENIOR_DB, tz.lead_id);
  const f = facility(ctx, tz.facility_id);
  const text = [
    `Here is the family you accepted. Please reach out today.`,
    '',
    fullLeadText(lead),
    '',
    terms,
    `Released to ${f ? f.name : tz.facility_id} at ${ctx.now}.`
  ].join('\n');
  await sendEmail(ctx.env, { to: tz.facility_email, subject: `Family lead details - ${lead.id}`, text, kind: 'release', leadId: lead.id, facilityId: tz.facility_id, transactional: true, now: ctx.now,
    why: `You are receiving this because ${f ? f.name : 'your community'} accepted this lead on ${BRAND}.` });
  await notifyOwner(ctx, lead, `Senior lead accepted (${option}) - ${lead.id} - ${f ? f.name : tz.facility_id}`,
    `${f ? f.name : tz.facility_id} (${tz.facility_id}) accepted lead ${lead.id}.\n${terms}\nRelease ${await releasedCount(ctx.env.SENIOR_DB, lead.id)} of ${M.MAX_ACCEPTS}.`);
}

/** "Accept, pay one month's rent on move-in": the click (a POST) is the acceptance. */
export async function acceptRent(ctx, t) {
  const db = ctx.env.SENIOR_DB;
  const tz = await teaserByToken(db, t);
  if (!tz) return { state: 'unknown' };
  const claim = await claimSlot(ctx, tz, 'rent', null);
  if (claim.state === 'taken') await recordLate(ctx, tz, 'rent');
  if (claim.state === 'released') await releaseEmail(ctx, tz, 'rent', claim.terms);
  return { state: claim.state };
}

/** "Pay $800 now": a Checkout Session, unless the lead is already taken. */
export async function startFlatCheckout(ctx, t) {
  const db = ctx.env.SENIOR_DB;
  const tz = await teaserByToken(db, t);
  if (!tz) return { state: 'unknown' };
  const mine = await db.prepare("SELECT 1 FROM accepts WHERE lead_id = ? AND facility_id = ? AND status = 'released'").bind(tz.lead_id, tz.facility_id).first();
  if (mine) return { state: 'already' };
  if ((await releasedCount(db, tz.lead_id)) >= M.MAX_ACCEPTS) {
    await recordLate(ctx, tz, 'flat');
    return { state: 'taken' };
  }
  const price = await priceId(ctx.env, FLAT_LOOKUP_KEY);
  const back = `${ctx.origin}/api/senior-accept?t=${tz.token}&o=flat`;
  const session = await stripe(ctx.env, 'POST', 'checkout/sessions', {
    mode: 'payment',
    line_items: { 0: { price, quantity: 1 } },
    customer_email: tz.facility_email,
    client_reference_id: `${tz.lead_id}:${tz.facility_id}`,
    metadata: { kind: 'senior_lead_flat', lead_id: tz.lead_id, facility_id: tz.facility_id, teaser_token: tz.token },
    payment_intent_data: { metadata: { kind: 'senior_lead_flat', lead_id: tz.lead_id, facility_id: tz.facility_id } },
    success_url: `${back}&paid={CHECKOUT_SESSION_ID}`,
    cancel_url: back
  });
  await db.prepare('UPDATE teasers SET checkout_started_at = ? WHERE id = ?').bind(ctx.now, tz.id).run();
  return { state: 'checkout', url: session.url };
}

/**
 * A paid flat session (from the webhook or the success URL; whichever comes first).
 * Idempotent by session id. Paid after five releases: recorded late and refunded.
 */
export async function releaseFlat(ctx, session) {
  const db = ctx.env.SENIOR_DB;
  const md = session.metadata || {};
  if (md.kind !== 'senior_lead_flat' || session.payment_status !== 'paid') return { state: 'ignored' };
  const seen = await db.prepare('SELECT status FROM accepts WHERE stripe_session_id = ?').bind(session.id).first();
  if (seen) return { state: seen.status === 'released' ? 'released' : 'taken', duplicate: true };
  const tz = await teaserByToken(db, md.teaser_token);
  if (!tz || tz.lead_id !== md.lead_id || tz.facility_id !== md.facility_id) return { state: 'unknown' };
  const claim = await claimSlot(ctx, tz, 'flat', session.id);
  if (claim.state === 'released') {
    await releaseEmail(ctx, tz, 'flat', claim.terms);
    return { state: 'released' };
  }
  await recordLate(ctx, tz, 'flat', session.id);
  let refundId = null;
  try {
    const refund = await stripe(ctx.env, 'POST', 'refunds', { payment_intent: session.payment_intent, reason: 'requested_by_customer', metadata: { kind: 'senior_lead_flat_late', lead_id: tz.lead_id } });
    refundId = refund.id;
    await db.prepare('UPDATE accepts SET refund_id = ? WHERE stripe_session_id = ?').bind(refundId, session.id).run();
  } catch (e) {
    log('error', 'refund failed', tz.lead_id, String(e.message || e));
  }
  const lead = await getLead(db, tz.lead_id);
  await notifyOwner(ctx, lead, `Senior lead paid after it was taken - ${lead.id}`,
    `${tz.facility_id} paid $800 (session ${session.id}) after ${claim.state === 'already' ? 'already holding the details' : `${M.MAX_ACCEPTS} communities had the details`}. Recorded late. Refund: ${refundId || 'FAILED - refund by hand in Stripe'}.`);
  return { state: claim.state === 'already' ? 'already' : 'taken', refundId };
}

/* ---------------------------------------------------------------- seat subscription */

export function addMonths(iso, months) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

export async function seatCheckoutCompleted(ctx, session) {
  const db = ctx.env.SENIOR_DB;
  const md = session.metadata || {};
  if (md.kind !== 'senior_seat') return { state: 'ignored' };
  const dup = await db.prepare("SELECT 1 FROM seat_events WHERE event = 'checkout_completed' AND stripe_ref = ?").bind(String(session.subscription || session.id)).first();
  if (dup) return { state: 'duplicate' };
  await db.prepare('INSERT INTO seat_events (at, event, facility_id, detail, stripe_ref) VALUES (?, ?, ?, ?, ?)')
    .bind(ctx.now, 'checkout_completed', md.facility_id || null, `session ${session.id}`, String(session.subscription || session.id)).run();
  let cancelAt = null;
  if (session.subscription) {
    cancelAt = Math.floor(Date.parse(addMonths(ctx.now, SEAT_TERM_MONTHS)) / 1000);
    try {
      await stripe(ctx.env, 'POST', `subscriptions/${session.subscription}`, { cancel_at: cancelAt });
      await db.prepare('INSERT INTO seat_events (at, event, facility_id, detail, stripe_ref) VALUES (?, ?, ?, ?, ?)')
        .bind(ctx.now, 'subscription_cancel_at_set', md.facility_id || null, new Date(cancelAt * 1000).toISOString(), session.subscription).run();
    } catch (e) {
      log('error', 'cancel_at failed', String(e.message || e));
      cancelAt = null;
    }
  }
  const f = facility(ctx, md.facility_id);
  await notifyOwner(ctx, null, `Seat paid - ${f ? f.name : md.facility_id}`, [
    `${f ? f.name : md.facility_id} (${md.facility_id}) started the Exclusive lead routing - Memphis subscription.`,
    `Subscription: ${session.subscription || '(none)'}; 60-day trial; ends ${cancelAt ? new Date(cancelAt * 1000).toISOString().slice(0, 10) : 'NOT SET - set cancel_at in Stripe by hand'}.`,
    '',
    'To switch routing on, edit data/senior_seat.json as docs/SENIOR_LEAD_RUNBOOK.md says:',
    JSON.stringify({ active: true, facility_id: md.facility_id, start: ctx.now.slice(0, 10), end: cancelAt ? new Date(cancelAt * 1000).toISOString().slice(0, 10) : addMonths(ctx.now, 6).slice(0, 10) })
  ].join('\n'));
  return { state: 'recorded', cancelAt };
}

/* ---------------------------------------------------------------- follow-ups */

export async function scheduleFollowups(ctx, lead) {
  const db = ctx.env.SENIOR_DB;
  await db.batch(FOLLOWUP_DAYS.map((d) => db.prepare('INSERT OR IGNORE INTO followups (lead_id, day, due_at, token) VALUES (?, ?, ?, ?)')
    .bind(lead.id, d, addDays(lead.created_at, d), token())));
}

async function followupChoices(ctx, lead) {
  const db = ctx.env.SENIOR_DB;
  const released = (await db.prepare("SELECT facility_id FROM accepts WHERE lead_id = ? AND status = 'released' ORDER BY id").bind(lead.id).all()).results.map((r) => r.facility_id);
  const ids = [lead.seat_facility_id, ...released, ...parseList(lead.shown_ids)].filter(Boolean);
  return [...new Set(ids)].map((id) => facility(ctx, id)).filter(Boolean).slice(0, 25);
}

export async function sendFollowup(ctx, fu) {
  const db = ctx.env.SENIOR_DB;
  const lead = await getLead(db, fu.lead_id);
  if (!lead || !lead.email || lead.outcome === 'moved_in' || lead.outcome === 'elsewhere') {
    await db.prepare('UPDATE followups SET skipped = ? WHERE id = ?').bind(lead && lead.outcome ? `outcome ${lead.outcome}` : 'no email', fu.id).run();
    return false;
  }
  const base = `${ctx.origin}/api/senior-followup?t=${fu.token}`;
  const choices = await followupChoices(ctx, lead);
  const who = lead.kind === 'professional' ? 'your patient' : (lead.senior_first_name || 'your family');
  const text = [
    `Hello${lead.name ? ` ${lead.name}` : ''},`,
    '',
    `It has been ${fu.day} days since you asked ${BRAND} about senior living for ${who}. Did you choose a community? Which one? One tap is enough:`,
    '',
    ...choices.map((f) => `${f.name}: ${base}&a=moved_in&f=${encodeURIComponent(f.id)}`),
    `Not yet: ${base}&a=not_yet`,
    `We chose somewhere else: ${base}&a=elsewhere`
  ].join('\n');
  const r = await sendEmail(ctx.env, { to: lead.email, subject: `Did you choose a community? (${BRAND})`, text, kind: `followup_${fu.day}`, leadId: lead.id, now: ctx.now,
    why: `You are receiving this because you asked ${BRAND} for help finding senior living.` });
  await db.prepare(r.ok ? 'UPDATE followups SET sent_at = ? WHERE id = ?' : 'UPDATE followups SET skipped = ? WHERE id = ?').bind(r.ok ? ctx.now : `send failed: ${r.reason}`, fu.id).run();
  return r.ok;
}

export async function answerFollowup(ctx, t, answer, facilityId) {
  const db = ctx.env.SENIOR_DB;
  const fu = await db.prepare('SELECT * FROM followups WHERE token = ?').bind(String(t || '')).first();
  if (!fu || !['moved_in', 'not_yet', 'elsewhere'].includes(answer)) return { state: 'unknown' };
  const lead = await getLead(db, fu.lead_id);
  const fid = answer === 'moved_in' ? String(facilityId || '') : null;
  const f = fid ? facility(ctx, fid) : null;
  if (answer === 'moved_in' && !f) return { state: 'unknown' };
  await db.batch([
    db.prepare('UPDATE followups SET answered_at = ?, answer = ?, facility_id = ? WHERE id = ?').bind(ctx.now, answer, fid, fu.id),
    db.prepare('UPDATE leads SET outcome = ?, outcome_facility_id = ?, outcome_at = ? WHERE id = ?').bind(answer, fid, ctx.now, lead.id)
  ]);
  if (answer === 'moved_in') {
    const deals = (await db.prepare("SELECT option, terms, released_at FROM accepts WHERE lead_id = ? AND facility_id = ? AND status = 'released'").bind(lead.id, fid).all()).results;
    const seatHolder = lead.seat_facility_id === fid;
    const invoice = deals.some((d) => d.option === 'rent')
      ? `INVOICE: ${f.name} accepted on rent terms. Invoice one month's rent now.`
      : deals.some((d) => d.option === 'flat') ? `${f.name} already paid the $800 flat fee. Nothing to invoice.`
        : seatHolder ? `${f.name} is the seat holder (covered by the $249/month subscription). Nothing extra to invoice.`
          : `${f.name} had no accepted terms on this lead. Nothing to invoice.`;
    await notifyOwner(ctx, lead, `Move-in reported - ${f.name} - ${lead.id}`, [
      invoice, '', `The family reported a move-in to ${f.name} (${fid}) at the day-${fu.day} follow-up, ${ctx.now}.`,
      ...deals.map((d) => `Accepted: ${d.terms} Released ${d.released_at}.`)
    ].join('\n'));
  }
  if (answer === 'not_yet' && lead.status === 'seat_working' && fu.day === 30) {
    await passToOpenRound(ctx, lead, 'not_placed', 'Working it, but the family reported not placed at the day-30 follow-up');
  }
  return { state: 'recorded', answer, facility: f };
}

/* ---------------------------------------------------------------- tick */

export async function tick(ctx) {
  const db = ctx.env.SENIOR_DB;
  const cutoff = addHours(ctx.now, -RELEASE_HOURS);
  const expired = (await db.prepare("SELECT * FROM leads WHERE status = 'seat_offered' AND seat_offered_at <= ? LIMIT ?").bind(cutoff, TICK_BATCH).all()).results;
  let timed = 0;
  for (const lead of expired) {
    await passToOpenRound(ctx, lead, 'timed_pass', `no click within ${RELEASE_HOURS} hours`);
    timed += 1;
  }
  const teasers = await sendQueuedTeasers(ctx);
  const due = (await db.prepare('SELECT * FROM followups WHERE sent_at IS NULL AND skipped IS NULL AND answered_at IS NULL AND due_at <= ? ORDER BY due_at LIMIT ?').bind(ctx.now, TICK_BATCH).all()).results;
  let followups = 0;
  for (const fu of due) if (await sendFollowup(ctx, fu)) followups += 1;
  return { timed_passes: timed, teasers_sent: teasers, followups_sent: followups };
}
