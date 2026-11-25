#!/usr/bin/env python3
"""USCIS field office jurisdiction, summarised by state.

Why this exists. Every uscisexam.com /states/<ST>/ hub was the same explainer with
the state name and one field office swapped in: New Hampshire, North Carolina and
Kansas were more than half identical (5-word shingles, Search Readiness q1, 24 Nov
2026), because the only state fact the generator had was the field office of the
one or two cities we cover there (data/research/uscis_medical/field_office_assignments.json,
which keeps covered cities only). The same public USCIS file says, for every ZIP
code in the state, which field office holds its interviews. That split is true only
of that state, and it is what someone reading a state page needs: which office their
notice will name, and whether it is in another state.

Source: USCIS, Field Office Locator ZIP code assignment data (the file the city
research already cites).
https://www.uscis.gov/about-us/find-a-uscis-office/field-offices
File: https://www.uscis.gov/sites/default/files/document/data/field_office_zip_<vintage>.csv

What it does NOT say, which every page built on it must keep:
  - The assignment is by ZIP code of residence; the applicant's own notice names the
    office, and USCIS can schedule elsewhere.
  - A field office holds interviews; it does not do the immigration medical exam.
  - Rows with IsRetired=TRUE are left out (the same method as the city file).

Usage: python3 -I scripts/research/pull_uscis_field_office_states.py <download_dir> [vintage]
       (the CSV is downloaded into <download_dir> if absent; vintage defaults to the
        one the city file was built from)
Writes data/research/uscis_medical/field_office_states.json.
"""
import csv
import datetime
import json
import os
import sys
import urllib.request
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'research', 'uscis_medical', 'field_office_states.json')
CITY_FILE = os.path.join(ROOT, 'data', 'research', 'uscis_medical', 'field_office_assignments.json')
LANDING = 'https://www.uscis.gov/about-us/find-a-uscis-office/field-offices'
TOP_COUNTIES = 4
TOP_PLACES = 5


def city_vintage():
    try:
        with open(CITY_FILE, encoding='utf-8') as f:
            return json.load(f)['source']['file_vintage']
    except (OSError, KeyError, ValueError):
        return ''


def main(argv):
    if len(argv) < 2:
        sys.exit('usage: pull_uscis_field_office_states.py <download_dir> [vintage]')
    dl = argv[1]
    vintage = argv[2] if len(argv) > 2 else city_vintage()
    if not vintage:
        sys.exit('NAMED_STOP: NO_VINTAGE pass the file vintage (e.g. 08-25-26)')
    url = 'https://www.uscis.gov/sites/default/files/document/data/field_office_zip_%s.csv' % vintage
    os.makedirs(dl, exist_ok=True)
    fp = os.path.join(dl, 'field_office_zip_%s.csv' % vintage)
    if not os.path.exists(fp):
        # uscis.gov answers 403 to a bare client; a browser user agent is served.
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'})
        with urllib.request.urlopen(req, timeout=300) as r, open(fp, 'wb') as f:
            f.write(r.read())

    zips = defaultdict(set)                               # state -> ZIPs
    counties = defaultdict(set)                           # state -> counties
    office_zips = defaultdict(lambda: defaultdict(set))   # state -> office -> ZIPs
    office_counties = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))  # state -> office -> county -> ZIPs
    office_places = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))    # state -> office -> city -> ZIPs
    offices = {}
    rows = 0
    with open(fp, encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            rows += 1
            if str(row.get('IsRetired', '')).strip().upper() == 'TRUE':
                continue
            st = (row.get('State') or '').strip().upper()
            z = (row.get('ZipCode') or '').strip()
            des = (row.get('FieldOfficeDesignation') or '').strip()
            if len(st) != 2 or not z or not des:
                continue
            county = (row.get('County') or '').strip()
            # Connecticut's rows carry the literal "None": the state replaced
            # counties with planning regions in 2022 and the file has neither.
            if county.lower() in ('none', 'null', 'n/a'):
                county = ''
            place = (row.get('City') or '').strip().title()
            zips[st].add(z)
            if county:
                counties[st].add(county)
                office_counties[st][des][county].add(z)
            if place:
                office_places[st][des][place].add(z)
            office_zips[st][des].add(z)
            offices.setdefault(des, {
                'designation': des,
                'office_name': (row.get('FieldOfficeName') or '').strip(),
                'street': (row.get('FieldOfficeStreetAddress') or '').strip(),
                'office_city': (row.get('FieldOfficeCity') or '').strip(),
                'office_state': (row.get('FieldOfficeState') or '').strip().upper(),
                'office_zip': (row.get('FieldOfficeZipCode') or '').strip().zfill(5),
                'district': (row.get('DistrictName') or '').strip(),
            })

    out_states = {}
    for st in sorted(zips):
        rows_out = []
        for des, zs in sorted(office_zips[st].items(), key=lambda kv: (-len(kv[1]), kv[0])):
            top = sorted(office_counties[st][des].items(), key=lambda kv: (-len(kv[1]), kv[0]))
            places = sorted(office_places[st][des].items(), key=lambda kv: (-len(kv[1]), kv[0]))
            rows_out.append(dict(offices[des], zip_codes=len(zs), counties=len(office_counties[st][des]),
                                 top_counties=[c for c, _ in top[:TOP_COUNTIES]],
                                 top_places=[{'place': p, 'zip_codes': len(v)} for p, v in places[:TOP_PLACES]],
                                 in_another_state=offices[des]['office_state'] != st))
        out_states[st] = {
            'zip_codes': len(zips[st]),
            'counties': len(counties[st]),
            'field_offices': rows_out,
        }

    doc = {
        '$schema': 'lkg-uscis-field-office-states-v1',
        'source': {
            'publisher': 'U.S. Citizenship and Immigration Services',
            'title': 'Field Office Locator ZIP code assignment data',
            'page': LANDING,
            'file': url,
            'file_vintage': vintage,
            'retrieved_on': datetime.date.today().isoformat(),
            'rows_in_file': rows,
            'method': 'Rows with IsRetired=TRUE excluded. Grouped by the CSV State column, then counted by field office (ZIP codes, counties, and the CSV City column for places). A County of "None" (Connecticut) is treated as missing.',
        },
        'limits': [
            'Assignment is by ZIP code of residence; the applicant\'s own notice names the office.',
            'A field office holds interviews and does not do the immigration medical exam.',
        ],
        'states': out_states,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('OUTPUT uscis_field_office_states states=%d rows=%d' % (len(out_states), rows))
    if len(out_states) < 50:
        sys.exit('NAMED_STOP: USCIS_FILE_SHORT only %d states read' % len(out_states))


if __name__ == '__main__':
    main(sys.argv)
