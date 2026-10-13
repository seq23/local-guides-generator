/**
 * EVERY senior email goes through composeEmail, and composeEmail refuses to build a
 * message without the CAN-SPAM shape (mirrors boss-os src/worker/boss/outreach/compose.ts):
 *   - a working one-click unsubscribe link in the body AND a List-Unsubscribe header
 *     (+ List-Unsubscribe-Post: One-Click);
 *   - the postal address of The Industry Guides (SENIOR_POSTAL_ADDRESS, private runtime data);
 *   - "Memphis Senior Care Homes is a property of The Industry Guides." and the one company
 *     contact, hello@theindustryguides.com;
 *   - an honest From on the Resend-verified theindustryguides.com domain.
 * sendEmail is the only place in the senior backend that calls Resend
 * (scripts/validation/senior_static_contract.js pins that).
 */
import { BRAND, esc, origin, token as newToken, log } from './util.mjs';

export const UMBRELLA_COMPANY = 'The Industry Guides';
export const UMBRELLA_CONTACT = 'hello@theindustryguides.com';
// Pinned in code, never read from EMAIL_FROM: the same rule as request-assistance.js
// (DECISION-LOG 2026-10-12, enforced by footer_contract.js), so a stale dashboard value
// can never put another company's sender on these emails. theindustryguides.com is the
// Resend-verified domain on this key (checked 13 Oct 2026 via GET /domains).
export const SENIOR_FROM = 'The Industry Guides <hello@theindustryguides.com>';
export const FOOTER_STYLE = 'font-size:10px;line-height:14px;color:#8a8a8a;';
export const FOOTER_COMPANY_LINE = `${BRAND} is a property of ${UMBRELLA_COMPANY}.`;

export function unsubscribeUrl(env, unsubToken) {
  return `${origin(env)}/api/senior-unsubscribe?t=${encodeURIComponent(unsubToken)}`;
}

export function composeEmail({ env, to, subject, text, why, unsubToken, postalAddress }) {
  if (!unsubToken) throw new Error('Refused: no unsubscribe token, so the email would have no unsubscribe link.');
  const address = String(postalAddress || '').trim();
  if (address.length < 10) throw new Error('Refused: no postal address (SENIOR_POSTAL_ADDRESS). CAN-SPAM requires one in every email.');
  if (!to) throw new Error('Refused: no recipient.');
  const unsub = unsubscribeUrl(env, unsubToken);
  const lines = [FOOTER_COMPANY_LINE, `${UMBRELLA_COMPANY}, ${address} · ${UMBRELLA_CONTACT}`];
  const reason = why || `You are receiving this because of a request made on ${BRAND}.`;
  const body = `${text}\n\n--\n${reason} Unsubscribe with one click: ${unsub}\n${lines.join('\n')}\n`;
  const htmlBody =
    '<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#222222;">' +
    `<div>${linkify(esc(text)).replace(/\n/g, '<br>')}</div>` +
    `<p style="${FOOTER_STYLE}margin-top:24px;">${esc(reason)} ` +
    `<a href="${esc(unsub)}" style="color:#8a8a8a;">Unsubscribe with one click</a>.<br>` +
    `${lines.map(esc).join('<br>')}</p></body></html>`;
  return {
    to,
    subject: String(subject || '').trim(),
    text: body,
    html: htmlBody,
    headers: {
      'List-Unsubscribe': `<${unsub}>, <mailto:${UMBRELLA_CONTACT}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}

function linkify(s) {
  return s.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

/** The unsubscribe token for an address, created on first use. */
export async function recipientToken(db, email, now) {
  const addr = String(email).trim().toLowerCase();
  const row = await db.prepare('SELECT token, unsubscribed_at FROM recipients WHERE email = ?').bind(addr).first();
  if (row) return row;
  const t = newToken(16);
  await db.prepare('INSERT OR IGNORE INTO recipients (email, token, created_at) VALUES (?, ?, ?)').bind(addr, t, now).run();
  return db.prepare('SELECT token, unsubscribed_at FROM recipients WHERE email = ?').bind(addr).first();
}

/**
 * Compose + send + log one email. Never throws: returns { ok, reason }.
 * `transactional` mail (the owner's notices, a released lead the facility paid for) still
 * carries the footer, but is not suppressed by an unsubscribe: it is the record of a deal.
 */
export async function sendEmail(env, { to, subject, text, why, kind, leadId = null, facilityId = null, transactional = false, now }) {
  const db = env.SENIOR_DB;
  const at = now || new Date().toISOString();
  const recipients = String(to || '').split(',').map((a) => a.trim()).filter(Boolean);
  if (!recipients.length) return record(db, at, kind, leadId, facilityId, false, null, 'no_recipient');
  let lastId = null;
  for (const addr of recipients) {
    let msg;
    try {
      const r = await recipientToken(db, addr, at);
      if (r.unsubscribed_at && !transactional) {
        await record(db, at, kind, leadId, facilityId, false, null, 'unsubscribed');
        return { ok: false, reason: 'unsubscribed' };
      }
      msg = composeEmail({ env, to: addr, subject, text, why, unsubToken: r.token, postalAddress: env.SENIOR_POSTAL_ADDRESS });
    } catch (e) {
      log('error', 'compose refused', kind, String(e.message || e));
      return record(db, at, kind, leadId, facilityId, false, null, `refused: ${String(e.message || e).slice(0, 120)}`);
    }
    const key = String(env.RESEND_API_KEY || '').trim();
    if (!key) return record(db, at, kind, leadId, facilityId, false, null, 'missing_resend_key');
    let res;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: SENIOR_FROM, ...msg, to: [msg.to] })
      });
    } catch (e) {
      return record(db, at, kind, leadId, facilityId, false, null, 'resend_network');
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      log('error', 'resend failed', kind, res.status, detail);
      return record(db, at, kind, leadId, facilityId, false, null, `resend_${res.status}`);
    }
    const data = await res.json().catch(() => ({}));
    lastId = data && data.id ? String(data.id) : null;
  }
  return record(db, at, kind, leadId, facilityId, true, lastId, null);
}

async function record(db, at, kind, leadId, facilityId, ok, providerId, error) {
  try {
    await db.prepare('INSERT INTO sends (at, kind, lead_id, facility_id, ok, provider_id, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(at, kind || 'unknown', leadId, facilityId, ok ? 1 : 0, providerId, error).run();
  } catch (e) {
    log('error', 'sends log failed', String(e.message || e));
  }
  return { ok, reason: error || '' };
}
