# SOP (Day-0 VA + Manual): Namecheap + Cloudflare checks

## A) Namecheap bulk nameservers update
Use the file Owner gives you: `domain_nameservers.csv`.

Steps:
1) Namecheap → Domain List
2) Select domains (checkboxes)
3) Bulk Actions → Change Nameservers
4) Choose Custom DNS
5) Paste NS1 and NS2 (exactly from CSV for that domain)
6) Save

Reference schematic:
- `snapshots/Namecheap_Bulk_Nameservers_Schematic.png`

## B) Cloudflare confirmation
Cloudflare → Websites → search the domain
- Expect: Status = Active (green)

If a domain is missing or stuck Pending:
- report to Owner with domain list + screenshot.

## C) Redirect smoke test (browser)
For 3 random redirect domains:
- `https://domain.com/test?x=1`
- `https://www.domain.com/test?x=1`

Expect: it lands on the canonical domain.
If error page: screenshot + report to Owner.

## VA Red Flags (never touch)
- SSL/TLS mode
- DNSSEC
- deleting DNS records
- deleting Worker routes
- editing redirect rules/page rules
