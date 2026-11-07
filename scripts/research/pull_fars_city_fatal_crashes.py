#!/usr/bin/env python3
"""Fatal-crash counts for every theaccidentguides.com city, its county and its state.

Why this exists. Every /<city>/ page on the accident site was the same decision
checklist with the city name swapped in: Denver and Albuquerque were 0.84 alike
(5-word shingles), because nothing on either page was true only of that city
(Search Readiness q1, 7 Nov 2026). The one public, free, city-level fact an
accident page can honestly carry is what the federal crash census recorded there.

Source: National Highway Traffic Safety Administration, Fatality Analysis
Reporting System (FARS), national CSV files. FARS is a census of every crash on
a public road in the US in which someone died within 30 days.
https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars
Files: https://static.nhtsa.gov/nhtsa/downloads/FARS/<year>/National/FARS<year>NationalCSV.zip

What it does NOT say, which every page built on it must keep:
  - Fatal crashes only. Injury-only and property-damage crashes, which are almost
    every crash a reader of the site was in, are not in FARS.
  - CITY is the place FARS coded the crash to. A crash just outside the city
    limit is the county's, so the county figure is given beside it.
  - Counts, not rates: no population or traffic denominator is applied.

Usage: python3 -I scripts/research/pull_fars_city_fatal_crashes.py <download_dir> [year ...]
       (default years: 2024 2023; each zip is downloaded into <download_dir> if absent)
Writes data/research/pi/fars_city_fatal_crashes.json.
"""
import csv
import io
import json
import os
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'research', 'pi', 'fars_city_fatal_crashes.json')
CITIES = os.path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_pi_v1.json')
REGISTRY = os.path.join(ROOT, 'data', 'research', 'shared', 'us_city_registry.csv')
STATES = os.path.join(ROOT, 'data', 'us_states.json')
URL = 'https://static.nhtsa.gov/nhtsa/downloads/FARS/{y}/National/FARS{y}NationalCSV.zip'

NYC_COUNTIES = ['NEW YORK', 'KINGS', 'QUEENS', 'BRONX', 'RICHMOND']
# FARS codes the five boroughs as counties and most places inside them as
# neighbourhood "cities" (MIDDLE VILLAGE, Other ...), so New York City is the sum
# of its five counties. Everything else matches on FARS CITYNAME.
CITY_NAME_OVERRIDES = {
    'st-louis-mo': ['ST. LOUIS', 'SAINT LOUIS', 'ST LOUIS'],
    'kansas-city-ks': ['KANSAS CITY'],
    'nashville-tn': ['NASHVILLE', 'NASHVILLE-DAVIDSON'],
    'louisville-ky': ['LOUISVILLE', 'LOUISVILLE/JEFFERSON COUNTY', 'LOUISVILLE-JEFFERSON COUNTY'],
    'honolulu-hi': ['HONOLULU', 'URBAN HONOLULU'],
}


def county_name(raw):
    # "DENVER (31)" -> "DENVER"; "BALTIMORE (CITY) (510)" -> "BALTIMORE (CITY)".
    import re
    return re.sub(r'\s*\(\d+\)\s*$', '', raw).strip().upper()


def county_label(name, state):
    """How a reader names the place: Denver County, Orleans Parish; an independent
    city (Baltimore, St. Louis, Richmond) is its own county, so it has no label."""
    if '(CITY)' in name:
        return None
    base = ' '.join(w.capitalize() for w in name.split())
    if state == 'Louisiana':
        return base + ' Parish'
    if state == 'Alaska':
        return None
    return base + ' County'


def load_rows(zip_path, year):
    with zipfile.ZipFile(zip_path) as z:
        name = next(n for n in z.namelist() if n.lower().endswith('/accident.csv') or n.lower() == 'accident.csv')
        with z.open(name) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding='latin-1')):
                yield r


def summarize(rows):
    crashes = len(rows)
    deaths = sum(int(r['FATALS'] or 0) for r in rows)
    ped = sum(1 for r in rows if r['HARM_EVNAME'].strip().lower() == 'pedestrian')
    bike = sum(1 for r in rows if r['HARM_EVNAME'].strip().lower() == 'pedalcyclist')
    dark = sum(1 for r in rows if r['LGT_CONDNAME'].strip().lower().startswith('dark'))
    weekend = sum(1 for r in rows if r['DAY_WEEKNAME'].strip() in ('Saturday', 'Sunday'))
    roads = Counter(r['TWAY_ID'].strip() for r in rows if r['TWAY_ID'].strip())
    months = Counter(r['MONTHNAME'].strip() for r in rows if r['MONTHNAME'].strip())
    return {
        'fatal_crashes': crashes,
        'deaths': deaths,
        'pedestrian_first_harmful_event': ped,
        'pedalcyclist_first_harmful_event': bike,
        'in_dark_conditions': dark,
        'on_weekends': weekend,
        'top_trafficways': [[k, v] for k, v in roads.most_common(3) if v > 1],
        'top_month': list(months.most_common(1)[0]) if months else None,
    }


def main():
    if len(sys.argv) < 2:
        sys.exit('usage: pull_fars_city_fatal_crashes.py <download_dir> [year ...]')
    dl = sys.argv[1]
    years = [int(y) for y in sys.argv[2:]] or [2024, 2023]
    os.makedirs(dl, exist_ok=True)

    reg = {}
    with open(REGISTRY, encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            reg[r['city_slug']] = r
    slugs = [c['slug'] for c in json.load(open(CITIES, encoding='utf-8'))]
    states = json.load(open(STATES, encoding='utf-8'))
    # A slug the registry lacks is "<city words>-<st>": the same rule the
    # renderer uses for its market label.
    for s in slugs:
        if s in reg:
            continue
        st = s.rsplit('-', 1)[1].upper()
        if st not in states:
            sys.exit('NAMED STOP [CITY_STATE_UNKNOWN]: ' + s)
        reg[s] = {'city_name': ' '.join(w.capitalize() for w in s.rsplit('-', 1)[0].split('-')), 'state_code': st, 'state_name': states[st]}

    out = {
        'source': {
            'publisher': 'National Highway Traffic Safety Administration',
            'dataset': 'Fatality Analysis Reporting System (FARS), national CSV files (accident.csv)',
            'landing_page': 'https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars',
            'files': {str(y): URL.format(y=y) for y in years},
        },
        'limits': [
            'Fatal crashes only: a crash on a public road in which someone died within 30 days. Injury-only and property-damage crashes are not in FARS.',
            'The city is the place FARS coded the crash to; a crash just outside the city limit counts for the county, so the county figure is given beside it.',
            'Counts, not rates: no population or traffic denominator is applied.',
        ],
        'years': years,
        'cities': {},
        'states': {},
    }

    for y in years:
        zp = os.path.join(dl, 'FARS%dNationalCSV.zip' % y)
        if not os.path.exists(zp):
            sys.stderr.write('downloading %s\n' % URL.format(y=y))
            urllib.request.urlretrieve(URL.format(y=y), zp)
        rows = list(load_rows(zp, y))
        if not rows:
            sys.exit('NAMED STOP [FARS_EMPTY]: %s had no accident rows' % zp)
        by_city = defaultdict(list)
        by_county = defaultdict(list)
        by_state = defaultdict(list)
        for r in rows:
            st = r['STATENAME'].strip()
            by_state[st].append(r)
            by_county[(st, county_name(r['COUNTYNAME']))].append(r)
            by_city[(st, r['CITYNAME'].strip().upper())].append(r)
        for st, rr in by_state.items():
            out['states'].setdefault(st, {})[str(y)] = summarize(rr)
        for slug in slugs:
            g = reg[slug]
            st = g['state_name']
            entry = out['cities'].setdefault(slug, {'city': g['city_name'], 'state': st, 'state_abbr': g['state_code'], 'years': {}})
            if slug in ('new-york-city-ny', 'new-york-ny'):
                crow = [r for c in NYC_COUNTIES for r in by_county.get((st, c), [])]
                entry['county'] = 'the five boroughs (New York, Kings, Queens, Bronx and Richmond counties)'
                entry['years'][str(y)] = {'city': summarize(crow), 'county': None}
                continue
            names = CITY_NAME_OVERRIDES.get(slug, [g['city_name'].upper()])
            crow = [r for n in names for r in by_city.get((st, n), [])]
            counties = Counter(county_name(r['COUNTYNAME']) for r in crow)
            county = counties.most_common(1)[0][0] if counties else None
            if county and county_label(county, st):
                entry['county'] = county_label(county, st)
            entry['years'][str(y)] = {
                'city': summarize(crow),
                'county': summarize(by_county.get((st, county), [])) if county and county_label(county, st) else None,
            }

    zero = [s for s, e in out['cities'].items() if all(e['years'][str(y)]['city']['fatal_crashes'] == 0 for y in years)]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, indent=1, sort_keys=False)
        fh.write('\n')
    print('wrote %s: %d cities, %d states, years %s; no fatal crash coded to the city in any year: %s' % (
        os.path.relpath(OUT, ROOT), len(out['cities']), len(out['states']), years, ', '.join(zero) or 'none'))


if __name__ == '__main__':
    main()
