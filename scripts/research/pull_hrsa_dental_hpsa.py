#!/usr/bin/env python3
"""Dental Health Professional Shortage Areas (HPSAs), summarised by state.

Why this exists. Every dentistry /states/<ST>/ hub was the same comparison advice
with the state name swapped in: Arizona and Ohio were 0.74 alike (5-word
shingles), because nothing on either page was true only of that state (Search
Readiness q1, 10 Nov 2026). Most of those states have no researched city yet, so
the page has to carry a state-level fact. The one public, free, state-level fact
about access to a dentist is where the federal government has designated a
shortage of dentists.

Source: Health Resources and Services Administration (HRSA), Data Warehouse,
"HPSA - Dental Health" download. A HPSA is an area, population group or
facility HRSA designates as short of dentists.
https://data.hrsa.gov/data/download
File: https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_DH.csv

What it does NOT say, which every page built on it must keep:
  - A designation is a federal shortage finding, not a statement that no dentist
    is taking patients there.
  - Only HPSAs with status "Designated" are counted; "Proposed For Withdrawal" and
    "Withdrawn" rows are left out.
  - People covered and dentists needed are summed over geographic and population
    designations only. Facility designations (health centres, rural health
    clinics, tribal and correctional facilities) are counted, not summed: their
    population field is a patient count, which would double-count residents.

Usage: python3 -I scripts/research/pull_hrsa_dental_hpsa.py <download_dir>
       (the CSV is downloaded into <download_dir> if absent)
Writes data/research/dentistry/hrsa_dental_hpsa_by_state.json.
"""
import csv
import datetime
import json
import os
import sys
import urllib.request
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'research', 'dentistry', 'hrsa_dental_hpsa_by_state.json')
URL = 'https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_DH.csv'
LANDING = 'https://data.hrsa.gov/data/download'
GEOGRAPHIC = {'Geographic HPSA', 'High Needs Geographic HPSA'}
POPULATION = {'HPSA Population'}
TOP_COUNTIES = 8
TOP_DESIGNATIONS = 5


def num(v):
    try:
        return float(str(v).strip() or 0)
    except ValueError:
        return 0.0


def main(argv):
    if len(argv) < 2:
        sys.exit('usage: pull_hrsa_dental_hpsa.py <download_dir>')
    dl = argv[1]
    os.makedirs(dl, exist_ok=True)
    fp = os.path.join(dl, 'BCD_HPSA_FCT_DET_DH.csv')
    if not os.path.exists(fp):
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=300) as r, open(fp, 'wb') as f:
            f.write(r.read())

    # One row per HPSA component (a county or census tract of a designation):
    # keep the first row of each HPSA ID, and every county it touches.
    hpsas = {}
    counties = defaultdict(set)
    with open(fp, encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            if row.get('HPSA Status') != 'Designated' or row.get('HPSA Discipline Class') != 'Dental Health':
                continue
            hid = row['HPSA ID']
            hpsas.setdefault(hid, row)
            county = (row.get('Common County Name') or '').strip()
            if county:
                counties[hid].add(county)

    states = {}
    for hid, row in hpsas.items():
        ab = (row.get('Primary State Abbreviation') or '').strip().upper()
        if len(ab) != 2:
            continue
        s = states.setdefault(ab, {
            'state': (row.get('Primary State Name') or '').strip(),
            'designations': 0, 'geographic': 0, 'population_groups': 0, 'facilities': 0,
            'rural': 0, 'people_covered': 0, 'dentists_needed': 0.0, '_counties': {}, '_all': [],
        })
        kind = row.get('Designation Type') or ''
        score = int(num(row.get('HPSA Score')))
        s['designations'] += 1
        if (row.get('Rural Status') or '') in ('Rural', 'Partially Rural'):
            s['rural'] += 1
        if kind in GEOGRAPHIC or kind in POPULATION:
            s['geographic' if kind in GEOGRAPHIC else 'population_groups'] += 1
            s['people_covered'] += int(num(row.get('HPSA Designation Population')))
            s['dentists_needed'] += num(row.get('HPSA Shortage'))
            for c in counties[hid]:
                prev = s['_counties'].get(c, 0)
                s['_counties'][c] = max(prev, score)
            s['_all'].append({'name': (row.get('HPSA Name') or '').strip(), 'county': sorted(counties[hid])[0] if counties[hid] else '', 'score': score, 'kind': kind})
        else:
            s['facilities'] += 1

    out_states = {}
    for ab, s in sorted(states.items()):
        ranked = sorted(s['_counties'].items(), key=lambda kv: (-kv[1], kv[0]))
        out_states[ab] = {
            'state': s['state'],
            'designations': s['designations'],
            'geographic': s['geographic'],
            'population_groups': s['population_groups'],
            'facilities': s['facilities'],
            'rural_or_partly_rural': s['rural'],
            'people_covered': s['people_covered'],
            'dentists_needed': round(s['dentists_needed'], 1),
            'counties_with_designation': len(ranked),
            'top_counties': [{'county': c, 'max_score': sc} for c, sc in ranked[:TOP_COUNTIES]],
            'top_designations': sorted(s['_all'], key=lambda d: (-d['score'], d['name']))[:TOP_DESIGNATIONS],
        }

    doc = {
        'source': {
            'publisher': 'Health Resources and Services Administration (HRSA)',
            'dataset': 'HPSA - Dental Health (Data Warehouse download)',
            'landing_page': LANDING,
            'file': URL,
            'fetched_on': datetime.date.today().isoformat(),
        },
        'field_meaning': {
            'designations': 'HPSAs with status Designated, any type.',
            'geographic': 'Geographic and high-needs geographic HPSAs: a whole area short of dentists.',
            'population_groups': 'Population HPSAs: a group (usually low-income or Medicaid-eligible residents) short of dentists.',
            'facilities': 'Facility HPSAs: health centres, rural health clinics, tribal and correctional facilities.',
            'people_covered': 'Sum of the designation population of geographic and population HPSAs.',
            'dentists_needed': 'Sum of HPSA Shortage: full-time dentists needed to remove those designations.',
            'top_designations': 'Geographic and population HPSAs with the highest HPSA score, by name.',
            'top_counties': 'Counties touched by a geographic or population HPSA, highest HPSA score first (scores run 0-26; higher is a greater shortage).',
        },
        'limits': [
            'A designation is a federal shortage finding, not a statement that no dentist is taking patients.',
            'Withdrawn and proposed-for-withdrawal designations are not counted.',
            'Facility designations are counted but not summed into people covered.',
        ],
        'states': out_states,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('OUTPUT hrsa_dental_hpsa_by_state states=%d designations=%d' % (len(out_states), sum(v['designations'] for v in out_states.values())))
    if not out_states:
        sys.exit('NAMED_STOP: HRSA_EMPTY no designated dental HPSA rows read')


if __name__ == '__main__':
    main(sys.argv)
