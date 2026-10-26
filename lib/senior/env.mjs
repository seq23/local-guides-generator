/**
 * Every environment name the senior lead backend reads, declared once with why.
 *
 * Reserved-name rule: no generic or platform-reserved name (ANTHROPIC_API_KEY, PATH,
 * NODE_OPTIONS, LD_PRELOAD, API_KEY, SECRET, TOKEN ...) is ever used. Each vendor
 * secret carries the vendor's name as its prefix, so it can never collide with a
 * name a runtime or another tool injects, and it says at a glance whose key it is.
 * scripts/validation/senior_static_contract.js fails if code reads a name not listed
 * here, or if any name here is reserved.
 */
export const SENIOR_ENV = {
  SENIOR_DB: 'D1 binding to the `senior-leads` database, the system of record. Prefixed SENIOR_ because the same functions/ directory ships to every guides Pages project; the senior endpoints answer 404 wherever this binding is absent.',
  STRIPE_SECRET_KEY: 'Stripe secret key (live in production, test in local runs). Vendor-prefixed so it is never a generic SECRET_KEY.',
  STRIPE_WEBHOOK_SECRET: 'Signing secret of the Stripe webhook endpoint /api/senior-stripe-webhook; every event signature is verified with it. Vendor-prefixed.',
  RESEND_API_KEY: 'Resend key for the theindustryguides.com sending domain. Vendor-prefixed; the same name request-assistance.js already reads.',
  LEAD_TO: 'Where the owner reads leads (hello@theindustryguides.com). Comma-separated list allowed. Plain var, same name request-assistance.js reads.',
  SENIOR_POSTAL_ADDRESS: 'The Industry Guides postal address for the CAN-SPAM footer. Private runtime data (never in git: the repo is public); copied from the Boss OS outreach state. composeEmail refuses to send without it.',
  SENIOR_TICK_TOKEN: 'Shared secret the GitHub Actions cron sends to /api/senior-tick (header x-senior-tick-token). Prefixed SENIOR_ so it is never a generic TOKEN.',
  SENIOR_SITE_ORIGIN: 'Optional public origin for links in emails. Defaults to https://memphisseniorcarehomes.com.',
  AIRTABLE_BASE_ID: 'Optional Airtable mirror (same names request-assistance.js reads); never blocks a lead.',
  AIRTABLE_TABLE_NAME: 'Optional Airtable mirror table.',
  AIRTABLE_API_TOKEN: 'Optional Airtable token. Vendor-prefixed.',
  BLOCKED_LEAD_DOMAINS: 'Optional comma-separated email domains whose form leads are dropped quietly (owner, 26 Oct 2026); exact domain or subdomain. Pages env var only, never in git (public repo). Same name request-assistance.js reads; lib/blocked_lead_domains.mjs.',
  ASSETS: 'Pages static-asset binding (platform-provided); used to read /data/facilities.json from the same deployment.'
};

/** Names that must never be used for a senior-backend variable. */
/**
 * Deliberately NOT read: EMAIL_FROM. The sender is pinned in lib/senior/email.mjs
 * (SENIOR_FROM), the same rule request-assistance.js follows.
 */
export const NOT_READ = ['EMAIL_FROM'];

export const RESERVED_ENV_NAMES = [
  'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'OPENAI_API_KEY', 'PATH', 'HOME', 'LD_PRELOAD',
  'LD_LIBRARY_PATH', 'NODE_OPTIONS', 'API_KEY', 'SECRET', 'SECRET_KEY', 'TOKEN', 'WEBHOOK_SECRET',
  'DB', 'DATABASE', 'CF_PAGES', 'CF_PAGES_URL', 'CF_PAGES_BRANCH', 'CF_PAGES_COMMIT_SHA', 'CLOUDFLARE_API_TOKEN'
];
