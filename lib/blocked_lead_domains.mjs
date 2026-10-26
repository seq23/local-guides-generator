// Blocked lead domains (owner ruling, 26 Oct 2026): a public form submission
// whose email domain is on the BLOCKED_LEAD_DOMAINS list is dropped quietly.
// The list lives ONLY in the Pages env var (comma-separated). It never appears
// in this repo: the repo is public and the list names real organisations.
// Unset or empty means nothing is blocked. Used by every public lead endpoint
// that takes a consumer email (functions/api/request-assistance.js and
// lib/senior/handlers.mjs handleLead); pinned by
// tests/request_form/blocked_lead_domains.test.mjs.

export function parseBlockedDomains(raw) {
  return String(raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, '').replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

/** The blocked list entry the email's domain matches (exact or subdomain), or ''. */
export function blockedDomainFor(email, rawList) {
  const list = parseBlockedDomains(rawList);
  if (!list.length) return '';
  const at = String(email || '').trim().lastIndexOf('@');
  if (at < 0) return '';
  const domain = String(email).trim().slice(at + 1).toLowerCase().replace(/\.+$/, '');
  if (!domain) return '';
  return list.find((d) => domain === d || domain.endsWith('.' + d)) || '';
}

/** Logs one line for a blocked submission. Never logs the address itself. */
export function logBlockedLead(domain, host) {
  console.log(`BLOCKED_LEAD domain=${domain} source=${host || ''}`);
}
