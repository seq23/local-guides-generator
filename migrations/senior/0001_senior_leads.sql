-- Memphis Senior Care Homes lead backend: D1 database `senior-leads`, bound to the
-- Pages project local-guides-generator-senior-living as SENIOR_DB.
-- D1 is the system of record. Every send, accept, release and pass is a timestamped
-- row: these rows are the invoice evidence (see docs/SENIOR_LEAD_RUNBOOK.md).
-- Health answers are stored as tiers and flags only, never free text.

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('family', 'professional')),
  who_for TEXT NOT NULL,
  zip TEXT,
  radius TEXT,
  care_tier INTEGER NOT NULL CHECK (care_tier IN (1, 2, 3)),
  adl_tasks TEXT,              -- JSON list of task keys, never free text
  memory_care INTEGER NOT NULL DEFAULT 0,
  dementia TEXT,               -- yes | no | not_sure
  wanders TEXT,                -- yes | no | ''
  budget_band TEXT,
  payers TEXT,                 -- JSON list of payer keys
  timeline TEXT,
  discharge_date TEXT,
  tags TEXT,                   -- JSON list of tag keys
  name TEXT,
  phone TEXT,
  email TEXT,
  senior_first_name TEXT,
  consent_contact INTEGER NOT NULL DEFAULT 0,
  consent_health INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,        -- seat_offered | seat_working | open_round | unsellable
  unsellable_reason TEXT,
  shown_ids TEXT,              -- JSON list of facility ids the family was shown as matches
  seat_facility_id TEXT,
  seat_offered_at TEXT,
  open_round_at TEXT,
  outcome TEXT,                -- moved_in | not_yet | elsewhere
  outcome_facility_id TEXT,
  outcome_at TEXT,
  -- Attribution, same column names as functions/api/request-assistance.js stores, so a
  -- guide or velocity page that sent the family here is kept on the lead.
  source_domain TEXT,
  src TEXT,
  intent_type TEXT,
  button_source TEXT,
  vertical_key TEXT,
  page_kind TEXT,
  page_slug TEXT,
  market_slug TEXT,
  edit_token TEXT,
  airtable_id TEXT
);
CREATE INDEX IF NOT EXISTS leads_status ON leads (status, seat_offered_at);

CREATE TABLE IF NOT EXISTS teasers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  facility_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  send_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  token TEXT NOT NULL UNIQUE,
  checkout_started_at TEXT,
  UNIQUE (lead_id, facility_id)
);
CREATE INDEX IF NOT EXISTS teasers_unsent ON teasers (sent_at, attempts);

CREATE TABLE IF NOT EXISTS accepts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  option TEXT NOT NULL CHECK (option IN ('flat', 'rent')),
  accepted_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('released', 'late')),
  stripe_session_id TEXT,
  released_at TEXT,
  refund_id TEXT,
  terms TEXT
);
CREATE INDEX IF NOT EXISTS accepts_lead ON accepts (lead_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS accepts_one_release ON accepts (lead_id, facility_id) WHERE status = 'released';
CREATE UNIQUE INDEX IF NOT EXISTS accepts_session ON accepts (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS seat_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  event TEXT NOT NULL,         -- offered | working | pass | timed_pass | not_placed | checkout_completed | subscription_cancel_at_set
  facility_id TEXT,
  lead_id TEXT,
  token TEXT,
  detail TEXT,
  stripe_ref TEXT
);
CREATE INDEX IF NOT EXISTS seat_events_lead ON seat_events (lead_id, event);
CREATE UNIQUE INDEX IF NOT EXISTS seat_events_token ON seat_events (token) WHERE token IS NOT NULL;

CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day IN (30, 60, 90)),
  due_at TEXT NOT NULL,
  sent_at TEXT,
  skipped TEXT,
  token TEXT NOT NULL UNIQUE,
  answered_at TEXT,
  answer TEXT,                 -- moved_in | not_yet | elsewhere
  facility_id TEXT,
  UNIQUE (lead_id, day)
);
CREATE INDEX IF NOT EXISTS followups_due ON followups (sent_at, due_at);

-- One row per address we have ever emailed: the one-click unsubscribe token lives here.
CREATE TABLE IF NOT EXISTS recipients (
  email TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  unsubscribed_at TEXT
);

-- Every email attempt, sent or refused: delivery evidence beside the business rows above.
CREATE TABLE IF NOT EXISTS sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  lead_id TEXT,
  facility_id TEXT,
  ok INTEGER NOT NULL,
  provider_id TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS sends_lead ON sends (lead_id);
