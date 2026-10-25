#!/usr/bin/env python3
"""
Generate the host-redirect Worker from inputs/domains.csv.

Two defects this file used to have.

1. It could not run. Line 49 was

       lines.append("  const path = url.pathname || "/";")

   which Python reads as "..." / ";" - a str divided by a str - so every
   invocation died with a TypeError before writing anything. The runbook's
   quick start calls this script, so the redirector could not be regenerated
   at all. Proven by running it: TypeError, exit 1 (25 Oct 2026).

2. It skipped `is_canonical == yes` rows entirely, so a canonical host's own
   `www` was never redirected. www.uscisexam.com, www.dentistryguides.com and
   www.memphisseniorcarehomes.com each answered 200 with their own copy of the
   site instead of a 301 to the apex - Search Readiness item a1 ("one canonical
   host; every other host 301s to it"). Google treats www and apex as separate
   sites unless told otherwise, and split signals rank nothing. The alias
   domains were always handled; only the canonicals' own www was missing.

   The apex of a canonical row is still never redirected: that is the host the
   site is served on.
"""
import csv
import datetime
import json
import sys

if len(sys.argv) < 3:
    raise SystemExit(f"usage: {sys.argv[0]} <inputs/domains.csv> <out.js>")

inp, outp = sys.argv[1], sys.argv[2]

redirects = {}
canonical_www = 0
with open(inp, newline="") as f:
    for row in csv.DictReader(f):
        domain = (row.get("domain") or "").strip().lower()
        canonical = (row.get("canonical_target") or "").strip()
        is_canonical = (row.get("is_canonical") or "").strip().lower() == "yes"
        is_parked = (row.get("is_parked") or "").strip().lower() == "yes"

        if not domain or is_parked:
            continue
        if not canonical:
            raise SystemExit(f"Missing canonical_target for domain: {domain}")
        canonical = canonical.replace("/$1", "").rstrip("/")

        if is_canonical:
            # The apex serves the site; only its www is redirected onto it.
            if not domain.startswith("www."):
                redirects[f"www.{domain}"] = canonical
                canonical_www += 1
            continue

        redirects[domain] = canonical
        # Alias domains are routed on apex and www both (attach_routes.sh), so
        # the Worker has to know both hosts or the www route falls through.
        if not domain.startswith("www."):
            redirects.setdefault(f"www.{domain}", canonical)

ts = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

# Service-worker syntax on purpose: scripts/deploy_worker.sh uploads the file
# as a single application/javascript body, which Cloudflare only accepts for
# service-worker scripts. A module-syntax worker needs a multipart upload with
# main_module metadata, so emitting `export default` here would make the
# runbook's own deploy step fail.
body = f"""// AUTO-GENERATED from inputs/domains.csv by scripts/regen_worker_from_csv.py
// Generated: {ts}
// Service-worker syntax. Host mapping. 301. Preserves path + query.
// {len(redirects)} host(s), including {canonical_www} canonical www host(s).

const REDIRECTS = {json.dumps(dict(sorted(redirects.items())), indent=2)};

addEventListener("fetch", (event) => {{
  event.respondWith(handle(event.request));
}});

async function handle(request) {{
  const url = new URL(request.url);
  const base = REDIRECTS[url.hostname.toLowerCase()];
  if (!base) return fetch(request);
  return Response.redirect(base + (url.pathname || "/") + (url.search || ""), 301);
}}
"""

with open(outp, "w") as out:
    out.write(body)

print(f"Wrote {outp} with {len(redirects)} host redirects ({canonical_www} canonical www)")
