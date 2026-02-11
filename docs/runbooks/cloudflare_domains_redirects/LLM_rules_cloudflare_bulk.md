# LLM Prompts + Rules (Listings / LKG: Cloudflare Domains + Redirects)

## System rules
- One CSV is the authority: `inputs/domains.csv`
- Redirect architecture MUST be Workers + Routes
- Redirect invariant:
  - 301
  - preserves path + query
  - applies to apex + www
- Redirect-only DNS invariant:
  - A @ = 192.64.119.112 proxied
  - CNAME www -> @ proxied
- Parked domains are excluded everywhere.

## Prompt: “Do the whole update, no partials”
You are updating the runbook at `docs/runbooks/cloudflare_domains_redirects/`.
Ship the complete operational surface area:
- scripts (idempotent + guardrails)
- verification scripts (pass/fail)
- SOP for Owner (terminal)
- SOP for VA (manual)
- friction audit + fixes
No redirect lists. No zone rulesets for redirects. Workers + routes only.

## Prompt: “Regenerate redirect worker”
Generate a Cloudflare Worker in service-worker syntax that:
- maps redirect hostname → canonical base URL (from CSV)
- 301 to canonical_base + pathname + search
- if host not mapped: fetch(request)
- never emits $1
