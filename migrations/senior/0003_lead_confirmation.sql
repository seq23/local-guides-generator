-- Double opt-in (security sweep, 3 Nov 2026). A new sellable lead is stored as
-- status 'pending_confirm' with a confirm_token. Nothing goes to any community and no
-- follow-up is scheduled until the family clicks the link in their confirmation email
-- (or the owner confirms a phone-only lead from the lead notice): then confirmed_at is
-- stamped and the lead is routed exactly as before. Additive only.
ALTER TABLE leads ADD COLUMN confirm_token TEXT;
ALTER TABLE leads ADD COLUMN confirmed_at TEXT;
CREATE INDEX IF NOT EXISTS leads_confirm_token ON leads (confirm_token);
