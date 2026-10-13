/** Small shared helpers for the senior lead backend. No vendor calls here. */

export const BRAND = 'Memphis Senior Care Homes';
export const DEFAULT_ORIGIN = 'https://memphisseniorcarehomes.com';

export function origin(env) {
  return String((env && env.SENIOR_SITE_ORIGIN) || DEFAULT_ORIGIN).replace(/\/+$/, '');
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' }
  });
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function token(bytes = 18) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function leadId() {
  return `L${Date.now().toString(36).toUpperCase()}${token(3).toUpperCase()}`;
}

export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

export function normalizePhone(s) {
  return String(s || '').trim().replace(/[^0-9()+\- .]/g, '').slice(0, 32);
}

export function normalizeZip(s) {
  const t = String(s || '').trim();
  return /^\d{5}(-\d{4})?$/.test(t) ? t.slice(0, 5) : '';
}

/** Same masking as request-assistance.js: no email or phone ever reaches a log. */
export function redactForLog(text) {
  return String(text || '')
    .replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@]+/g, '[email]')
    .replace(/\+?[\d][\d()\-. ]{7,}\d/g, '[phone]');
}

export function log(level, ...parts) {
  const line = parts.map((p) => redactForLog(typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
  (level === 'error' ? console.error : console.log)(`senior ${line}`);
}

export function addDays(iso, days) {
  return new Date(Date.parse(iso) + days * 86400000).toISOString();
}

export function addHours(iso, hours) {
  return new Date(Date.parse(iso) + hours * 3600000).toISOString();
}

export function parseList(v) {
  try {
    const a = JSON.parse(v || '[]');
    return Array.isArray(a) ? a : [];
  } catch (_) {
    return [];
  }
}

export function clip(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}
