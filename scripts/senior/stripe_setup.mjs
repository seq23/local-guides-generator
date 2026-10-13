#!/usr/bin/env node
/**
 * Idempotent Stripe setup for the senior-living lead backend.
 *   STRIPE_SECRET_KEY=<from the vault, never on a command line> node scripts/senior/stripe_setup.mjs [--webhook] [--secret-out <0600 file>]
 * Products are found by exact name, prices by lookup_key, the webhook by URL; nothing is
 * created twice. A webhook's signing secret is only returned when it is created, so
 * --secret-out writes it to a 0600 file for `vault set --from-file` and
 * `wrangler pages secret put` (the caller deletes the file). Prints ids only, never a secret.
 */
import fs from 'node:fs';
import { stripe, FLAT_LOOKUP_KEY, SEAT_LOOKUP_KEY, FLAT_PRODUCT_NAME, SEAT_PRODUCT_NAME } from '../../lib/senior/stripe.mjs';

const WEBHOOK_URL = 'https://memphisseniorcarehomes.com/api/senior-stripe-webhook';
const env = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY };
if (!env.STRIPE_SECRET_KEY) { console.error('STRIPE_SECRET_KEY not set'); process.exit(2); }
const args = process.argv.slice(2);
const wantWebhook = args.includes('--webhook');
const secretOut = args.includes('--secret-out') ? args[args.indexOf('--secret-out') + 1] : '';
const mode = env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test';

async function product(name, description) {
  const list = await stripe(env, 'GET', 'products', { active: 'true', limit: 100 });
  const found = (list.data || []).find((p) => p.name === name);
  if (found) return { id: found.id, created: false };
  const p = await stripe(env, 'POST', 'products', { name, description, metadata: { vertical: 'senior-living', owner: 'The Industry Guides' } });
  return { id: p.id, created: true };
}

async function price(productId, lookupKey, spec) {
  const list = await stripe(env, 'GET', 'prices', { 'lookup_keys[]': lookupKey, active: 'true', limit: 1 });
  const found = (list.data || [])[0];
  if (found && found.product === productId && found.unit_amount === spec.unit_amount) return { id: found.id, created: false };
  const p = await stripe(env, 'POST', 'prices', { product: productId, currency: 'usd', lookup_key: lookupKey, transfer_lookup_key: 'true', ...spec });
  return { id: p.id, created: true };
}

const out = { mode };
const flat = await product(FLAT_PRODUCT_NAME, 'One family lead from Memphis Senior Care Homes: full contact details, released on payment.');
out.flat_product = flat.id;
out.flat_price = (await price(flat.id, FLAT_LOOKUP_KEY, { unit_amount: 80000, nickname: 'Senior family lead (flat) $800' })).id;
const seat = await product(SEAT_PRODUCT_NAME, 'Exclusive first look at every fitting family lead in the Memphis area. 6-month term, 60-day trial.');
out.seat_product = seat.id;
out.seat_price = (await price(seat.id, SEAT_LOOKUP_KEY, { unit_amount: 24900, recurring: { interval: 'month' }, nickname: 'Exclusive lead routing - Memphis $249/month' })).id;

if (wantWebhook) {
  const hooks = await stripe(env, 'GET', 'webhook_endpoints', { limit: 100 });
  const found = (hooks.data || []).find((h) => h.url === WEBHOOK_URL);
  if (found) {
    out.webhook = found.id;
    out.webhook_created = false;
    if (secretOut) out.webhook_secret_written = false;
  } else {
    const h = await stripe(env, 'POST', 'webhook_endpoints', { url: WEBHOOK_URL, 'enabled_events[]': 'checkout.session.completed', description: 'Memphis Senior Care Homes lead release + seat subscription' });
    out.webhook = h.id;
    out.webhook_created = true;
    if (secretOut) {
      fs.writeFileSync(secretOut, h.secret, { mode: 0o600 });
      out.webhook_secret_written = true;
    }
  }
}
console.log(JSON.stringify(out));
