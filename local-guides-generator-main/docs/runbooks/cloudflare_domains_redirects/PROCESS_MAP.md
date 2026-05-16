# Process Map (Owner-friendly): what should have happened

### One source of truth
`inputs/domains.csv`

Everything (zones, nameservers, redirects, routes, verification) is derived from this file.

### Golden path
1) **Bulk add zones** (API) → export nameservers + zone IDs
2) **Bulk update Namecheap nameservers** (UI) → zones become Active
3) **Redirect system = Workers + Routes** (not redirect lists, not zone rulesets)
4) **Ensure redirect DNS** (A @ + CNAME www, proxied) → prevents 522
5) **Generate + deploy Worker** from CSV
6) **Attach routes** for both apex and www
7) **Verify** DNS + routes + HTTP (pass/fail)
8) **Snapshot docs** into repo (`docs/runbooks/cloudflare_domains_redirects/`)

That’s it. No alternate systems.
