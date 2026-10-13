# Senior lead runbook (memphisseniorcarehomes.com)

D1 database `senior-leads` (id `e36cb56a-6d35-400c-b28f-cd0a148d2e83`) is the system of record; branch previews use `senior-leads-preview`. Code: `lib/senior/`, routes `functions/api/senior-*.js`, wizard `assets/senior-intake.js`. Every new lead, pass, acceptance and reported move-in is emailed to `LEAD_TO` (hello@theindustryguides.com).

Run the queries below with:
`npx wrangler d1 execute senior-leads --remote --config migrations/senior/wrangler.toml --command "<SQL>"`

## Switch the exclusive seat on or off
1. The community pays through `POST /api/senior-seat-checkout {"facility_id":"<id>"}`. That returns a Stripe link for $249/month with 60 free days. When they pay, you get a "Seat paid" email with the exact line to paste, and Stripe ends the subscription after 6 months on its own (`cancel_at`).
2. Edit `data/senior_seat.json`. To switch it on: `{"active":true,"facility_id":"<id>","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}` (6 months at most; there is no lead cap). To switch it off: `{"active":false}`. Merge the change and the deploy follows on its own. `senior_seat_schema_contract.js` rejects a malformed file or a term longer than 6 months.
3. While a seat is on, each lead that fits the seat holder goes to them alone, in full. If they click **Pass**, or do not click within 72 hours, the lead goes to the open round. It also goes to the open round if they click **Working it** and the family says "not yet" at day 30.

## Read the invoice evidence
- Accepts (who took a lead, on which terms, and when): `SELECT lead_id, facility_id, option, status, accepted_at, released_at, stripe_session_id, refund_id FROM accepts ORDER BY id DESC`. `option='rent'` means you invoice one month's rent when the resident moves in. `flat` was already paid by card. `late` means they clicked after five communities had accepted; a late payment is refunded automatically.
- Move-ins (the invoice trigger): `SELECT id, outcome, outcome_facility_id, outcome_at FROM leads WHERE outcome = 'moved_in'`. The "Move-in reported" email says whether to invoice.
- Seat history: `SELECT * FROM seat_events ORDER BY id DESC`. Every email attempt: `SELECT * FROM sends ORDER BY id DESC`. Teasers: `SELECT lead_id, facility_id, sent_at, send_error FROM teasers`.
- Unsellable leads (Medicaid only, or tier 3, which is a skilled-nursing level of care): `SELECT id, unsellable_reason, created_at FROM leads WHERE status = 'unsellable'`.

## Funnel numbers
`curl -s -H "x-senior-tick-token: <SENIOR_TICK_TOKEN>" "https://memphisseniorcarehomes.com/api/senior-funnel?days=7"` returns counts with no personal details. It covers intake starts, results shown, leads, unsellable leads and their reasons, teasers, accepts (flat, rent, late), releases, passes, follow-up outcomes and the seat state. It also gives per-screen drop-off and leads grouped by page_kind/page_slug and by src.
Screen numbers: the family flow runs 1-11 (who → contact), the off-ramp is 12, off-ramp done is 13 and thanks is 14. The discharge-planner flow runs 21-26.

## A community says "no referral fees"
In `data/listings/senior-living/facilities.json`, add `"no_teasers": true` to that community's row, then merge. The community stays in the list families see, but it gets no more teasers. Anyone who uses an email's unsubscribe link is also suppressed at once (`recipients.unsubscribed_at`).

## Facility fields the matcher reads (`assets/senior-match.js`)
- **id:** `id`, then `slug`, then `license_number`, then name + ZIP.
- **Contact and location:** `name`, `phone`, `email`, `zip`, `lat`/`lng`.
- **Memory care:** `memory_care`, or a `care_types` or `services` list that includes "memory care".
- **Monthly rate:** `rate_min`/`rate_max`. A blank rate never excludes a community.
- **Teasers:** `no_teasers`.

The site publishes this file at `/data/facilities.json`.

## Clock, secrets, setup
- **Clock:** `.github/workflows/senior_tick.yml` POSTs `/api/senior-tick` every 15 minutes. It handles 72-hour releases, teaser retries and the day 30/60/90 follow-ups.
- **Pages secrets:** `STRIPE_SECRET_KEY` (live in production, test in preview), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SENIOR_POSTAL_ADDRESS` and `SENIOR_TICK_TOKEN` (also a GitHub secret). `lib/senior/env.mjs` explains each name. The D1 binding and `LEAD_TO` are set by `scripts/senior/bind_pages.sh`.
- **Stripe:** `scripts/senior/stripe_setup.mjs` is idempotent and safe to re-run. The webhook signing secret is in the vault as `stripe-industry-guides-webhook-secret`.
