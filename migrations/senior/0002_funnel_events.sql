-- Wizard funnel: anonymous screen-level progression, so drop-off is visible.
-- No PII: a random per-visit session id, the screen number, and page attribution only.
CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  session TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('screen', 'intake_start', 'results_shown')),
  screen INTEGER NOT NULL DEFAULT 0,
  page_kind TEXT,
  page_slug TEXT,
  src TEXT,
  UNIQUE (session, event, screen)
);
CREATE INDEX IF NOT EXISTS funnel_events_at ON funnel_events (at, event);
