#!/usr/bin/env python3
import csv, sys, datetime

inp = sys.argv[1]
outp = sys.argv[2]

redirects = {}
with open(inp, newline="") as f:
    r = csv.DictReader(f)
    for row in r:
        domain = (row.get("domain") or "").strip()
        canonical = (row.get("canonical_target") or "").strip()
        is_canonical = (row.get("is_canonical") or "").strip().lower()
        is_parked = (row.get("is_parked") or "").strip().lower()

        if not domain:
            continue
        if is_parked == "yes":
            continue
        if is_canonical == "yes":
            continue
        if not canonical:
            raise SystemExit(f"Missing canonical_target for redirect domain: {domain}")

        canonical = canonical.replace("/$1", "").rstrip("/")
        redirects[domain.lower()] = canonical

ts = datetime.datetime.utcnow().isoformat() + "Z"

lines = []
lines.append("// AUTO-GENERATED from inputs/domains.csv")
lines.append(f"// Generated: {ts}")
lines.append("// Service-worker syntax. Host mapping. 301. Preserves path + query.")
lines.append("")
lines.append("const REDIRECTS = {")
for host in sorted(redirects.keys()):
    lines.append(f'  "{host}": "{redirects[host]}",')
lines.append("};")
lines.append("")
lines.append('addEventListener("fetch", event => {')
lines.append("  event.respondWith(handle(event.request));")
lines.append("});")
lines.append("")
lines.append("async function handle(request) {")
lines.append("  const url = new URL(request.url);")
lines.append("  const host = url.hostname.toLowerCase();")
lines.append("  const base = REDIRECTS[host];")
lines.append("  if (!base) return fetch(request);")
lines.append("  const path = url.pathname || "/";")
lines.append("  const qs = url.search || "";")
lines.append("  return Response.redirect(base + path + qs, 301);")
lines.append("}")
lines.append("")

with open(outp, "w") as out:
    out.write("\n".join(lines))

print(f"Wrote {outp} with {len(redirects)} host redirects")
