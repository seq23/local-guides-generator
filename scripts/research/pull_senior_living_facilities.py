#!/usr/bin/env python3
"""Refresh data/listings/senior-living/facilities.json from public sources.

Sources (all public, no paid API):
  1. Tennessee Health Facilities Commission "Assisted Care Living Facilities Full
     Bed Report" (xlsx, quarterly): every licensed ACLF with licence number,
     address, county, total beds and secured (memory-care) beds.
     https://www.tn.gov/hfc/publication-and-reports/licensure-reports.html
  2. HFC Facility Listings search (facility type 0537, each county in COUNTIES)
     for the registry phone number of each licence.
     https://internet.health.tn.gov/FacilityListings/
  3. Each facility's own website (data/listings/senior-living/websites.json) for a
     public admissions/contact email. Empty when the site shows none.
  4. Mississippi State Department of Health Health Facilities Directory (Personal
     Care Homes, DeSoto and Marshall Counties), transcribed in
     ms_desoto_personal_care_homes.json.
  5. OpenStreetMap Nominatim for lat/lng (1 request per second, per its policy).

memory_care is true when the registry reports secured beds > 0: in Tennessee a
memory-care unit is a secured unit inside a licensed ACLF.

Usage: python3 scripts/research/pull_senior_living_facilities.py --report-url <xlsx url>
Requires openpyxl (pip install openpyxl). Run by hand when HFC posts a new quarter.
"""
import argparse, datetime, html, io, json, re, sys, time, urllib.parse, urllib.request, http.cookiejar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/listings/senior-living/facilities.json'
SITES = ROOT / 'data/listings/senior-living/websites.json'
MS_FILE = ROOT / 'data/listings/senior-living/ms_desoto_personal_care_homes.json'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
HFC = 'https://internet.health.tn.gov/FacilityListings/'
DEFAULT_REPORT = 'https://www.tn.gov/content/dam/tn/hfc/documents/HFC-ACLF_Full_Bed_Report_July2026.xlsx'
# Shelby plus the two Tennessee counties the town pages reach (Tipton: Atoka,
# Munford, Covington, Brighton; Fayette: Oakland, Somerville, Rossville).
COUNTIES = ('SHELBY', 'TIPTON', 'FAYETTE')
EMAIL_SKIP = re.compile(r'(example|sentry|wixpress|godaddy|domain|\.png|\.jpg|privacy|careers|jobs|hr@|accessibility|vendor)', re.I)


def fetch(url, opener=None, data=None, timeout=30):
    req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': 'text/html,*/*', 'Referer': HFC})
    return (opener or urllib.request.build_opener()).open(req, timeout=timeout).read()


def registry_rows(url):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(fetch(url)), read_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    head = [str(h or '').strip() for h in rows[0]]
    idx = {h: i for i, h in enumerate(head)}
    sec = next(i for i, h in enumerate(head) if h.lower().startswith('number of secured'))
    out = []
    for r in rows[1:]:
        if str(r[idx['county']] or '').strip().upper() not in COUNTIES:
            continue
        out.append({
            'license_number': str(r[idx['lic_no']]),
            'name': str(r[idx['fac_name']]).strip(),
            'license_status': str(r[idx['lic_status']]).strip(),
            'address': re.sub(r'\s+', ' ', str(r[idx['street']])).strip(),
            'city': str(r[idx['city']]).strip(),
            'state': 'TN',
            'zip': str(r[idx['zip']]).strip()[:5],
            'total_beds': int(r[idx['Total_Beds']] or 0),
            'secured_beds': int(r[sec] or 0),
        })
    return out


def hfc_phones():
    phones = {}
    for county in COUNTIES:
        phones.update(hfc_county_phones(county))
    return phones


def hfc_county_phones(county):
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    page = fetch(HFC, op).decode('utf-8', 'replace')
    tok = re.search(r'__RequestVerificationToken" type="hidden" value="([^"]+)', page).group(1)
    body = urllib.parse.urlencode({
        '__RequestVerificationToken': tok, 'CurrentSearchModel.RadioGroup': 'Curr',
        'CurrentSearchModel.FacilityType': '0537', 'CurrentSearchModel.County': county,
        'CurrentSearchModel.Name': '', 'CurrentSearchModel.AffiliateOnly': 'No'}).encode()
    res = fetch(HFC, op, data=body).decode('utf-8', 'replace')
    lines = [html.unescape(l).strip() for l in re.sub(r'<[^>]*>', '\n', res).split('\n')]
    lines = [l for l in lines if l]
    phones = {}
    for i, l in enumerate(lines):
        if not l.startswith('Administrator:'):
            continue
        phone = lines[i - 1]
        for k in range(i, min(i + 40, len(lines))):
            m = re.match(r'Facility License Number:\s*(\d+)', lines[k])
            if m:
                lic = str(int(m.group(1)))
                if lic != '0' and re.match(r'^\d{3}-\d{3}-\d{4}$', phone):
                    phones.setdefault(lic, phone)
                break
    return phones


def site_email(url):
    if not url:
        return ''
    pages = [url]
    base = '{0.scheme}://{0.netloc}'.format(urllib.parse.urlparse(url))
    pages += [base + '/contact/', base + '/contact-us/']
    for p in pages:
        try:
            t = fetch(p, timeout=15).decode('utf-8', 'replace')
        except Exception:
            continue
        for m in re.findall(r'mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', t):
            if not EMAIL_SKIP.search(m):
                return m.lower()
    return ''


def geocode(row):
    st = row.get('state') or 'TN'
    q = f"{row['address']}, {row['city']}, {st} {row['zip']}"
    for query in (q, f"{row['name']}, {row['city']}, {st}"):
        url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': query, 'format': 'json', 'limit': 1, 'countrycodes': 'us'})
        time.sleep(1.1)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'lgg-senior-living-directory/1.0 (hello@theindustryguides.com)'})
            js = json.loads(urllib.request.urlopen(req, timeout=30).read())
        except Exception:
            js = []
        if js:
            return round(float(js[0]['lat']), 6), round(float(js[0]['lon']), 6)
    # Street-level miss: fall back to the ZIP centroid so the row still maps.
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'postalcode': row['zip'], 'country': 'us', 'format': 'json', 'limit': 1})
    time.sleep(1.1)
    req = urllib.request.Request(url, headers={'User-Agent': 'lgg-senior-living-directory/1.0 (hello@theindustryguides.com)'})
    js = json.loads(urllib.request.urlopen(req, timeout=30).read())
    return (round(float(js[0]['lat']), 6), round(float(js[0]['lon']), 6)) if js else (None, None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report-url', default=DEFAULT_REPORT)
    a = ap.parse_args()
    rows = registry_rows(a.report_url)
    phones = hfc_phones()
    site_doc = json.loads(SITES.read_text())
    sites = {k: v for k, v in site_doc.items() if not k.startswith('_')}
    # Registry phones with a proven typo, corrected from the facility's own site.
    fixes = site_doc.get('_phone_corrections', {})
    email_overrides = site_doc.get('_email_overrides', {})
    forms = site_doc.get('_contact_forms', {})
    out = []
    for r in sorted(rows, key=lambda x: x['name'].lower()):
        lic = r['license_number']
        lat, lng = geocode(r)
        site = sites.get(lic, '')
        out.append({
            'name': r['name'], 'address': r['address'], 'city': r['city'], 'state': 'TN', 'zip': r['zip'],
            'phone': (fixes.get(lic) or {}).get('phone') or phones.get(lic, ''),
            'phone_source': 'facility website' if lic in fixes else 'HFC registry', 'license_type': 'Assisted Care Living Facility',
            'license_number': lic, 'license_status': r['license_status'],
            'total_beds': r['total_beds'], 'secured_beds': r['secured_beds'],
            'memory_care': r['secured_beds'] > 0, 'website': site,
            'email': (email_overrides.get(lic) or {}).get('email') or site_email(site),
            'email_source': (email_overrides.get(lic) or {}).get('source') or (site if site else ''),
            'contact_form_url': forms.get(lic, ''),
            'lat': lat, 'lng': lng,
        })
        print(f"{lic:>4} {r['name'][:40]:40} phone={phones.get(lic,'-')} mc={r['secured_beds']>0} geo={lat},{lng}", file=sys.stderr)
    for r in out:
        if not r['email']:
            r['email_source'] = ''
    # DeSoto and Marshall Counties, MS: MSDH publishes no licence numbers, so these rows carry a
    # registry key (MS-PCH-<zip>-<slug>) in license_number, which the lead
    # backend uses as the row id; license_number_kind says which it is.
    ms = json.loads(MS_FILE.read_text())
    for h in ms['homes']:
        row = {'name': h['name'], 'address': h['address'], 'city': h['city'], 'state': 'MS', 'zip': h['zip'],
               'lat': None, 'lng': None}
        lat, lng = geocode(row)
        slug = re.sub(r'[^a-z0-9]+', '-', h['name'].lower()).strip('-')
        out.append({
            'name': h['name'], 'address': h['address'], 'city': h['city'], 'state': 'MS', 'zip': h['zip'],
            'phone': h['phone'], 'phone_source': 'MSDH directory',
            'license_type': 'Personal Care Home - Assisted Living' + (" with Alzheimer's/Dementia Care Unit" if h['add_unit'] else ''),
            'license_number': f"MS-PCH-{h['zip']}-{slug}", 'license_number_kind': 'registry_key',
            'license_status': 'Licensed', 'total_beds': h['capacity'], 'secured_beds': None,
            'memory_care': bool(h['add_unit']), 'website': h['website'], 'email': h['email'],
            'email_source': h['website'] if h['email'] else '', 'contact_form_url': h['contact_form_url'],
            'lat': lat, 'lng': lng,
        })
        print(f"  MS {h['name'][:40]:40} mc={h['add_unit']} geo={lat},{lng}", file=sys.stderr)
    for r in out:
        r.setdefault('license_number_kind', 'state_license')
    doc = {
        'source': {
            'registry': a.report_url,
            'registry_index': 'https://www.tn.gov/hfc/publication-and-reports/licensure-reports.html',
            'phones': HFC + ' (facility type 0537 Assisted Care Living Facility, counties ' + ', '.join(COUNTIES) + ')',
            'emails': "each facility's own public website (websites.json); empty when none is shown",
            'geocoding': 'OpenStreetMap Nominatim (street address, else ZIP centroid)',
            'memory_care_rule': 'TN: secured_beds > 0 in the HFC bed report; MS: the MSDH directory marks an Alzheimer\'s/Dementia Care (AD/D) Unit',
            'ms_registry': ms['source'],
            'ms_directory_date': ms['directory_date'],
        },
        'fetched_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'county': 'Shelby, Tipton and Fayette Counties, TN; DeSoto and Marshall Counties, MS',
        'facilities': out,
    }
    OUT.write_text(json.dumps(doc, indent=2) + '\n')
    print(f'wrote {len(out)} facilities -> {OUT.relative_to(ROOT)}', file=sys.stderr)


if __name__ == '__main__':
    main()
