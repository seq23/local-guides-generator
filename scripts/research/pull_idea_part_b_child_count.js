#!/usr/bin/env node
/**
 * Pull the federal IDEA Part B child count, by state, into a version-pinned
 * local snapshot.
 *
 * Why this file exists.
 *
 * The neuro city pages, and most of the neuro guides, were written as though a
 * private clinic were the only way to get a child evaluated. Measured against
 * grounded answers in this vertical, that is wrong: two of the five routes an
 * assistant actually surfaced were not clinics at all - a school district
 * evaluation under IDEA and a consultative examination purchased by the Social
 * Security Administration. A page that only knows about the clinic is missing
 * the route that is free and the route that someone else pays for.
 *
 * So the pages need one honest number for the school route, per state, from a
 * primary federal source. This is that number: how many children a state's
 * public schools actually served under IDEA Part B. It is not a claim about
 * evaluation, diagnosis or outcome. It is a headcount, and it is published.
 *
 * Source, pinned:
 *   U.S. Department of Education, Office of Special Education Programs.
 *   EDPass: "IDEA Part B Child Count and Educational Environments Collection,"
 *   2024-25. Data extracted as of July 30, 2025 from file specifications 002
 *   and 089.
 *   Catalogue entry: IDEA Section 618 State Part B Child Count and Educational
 *   Environments, dataset 71ca7d0c-a161-4abe-9e2b-4e68ffb1061a on data.ed.gov.
 *   Distribution: resource fdc6eb2c-4a4e-44ef-8b3d-01e68671e47c,
 *   bchildcountandedenvironment2024-25.csv
 *
 * What is taken, and nothing else:
 *   - rows where SEA Education Environment is "Total, School Age", column
 *     "Ages 6-21"
 *   - rows where SEA Education Environment is "Total, Early Childhood", column
 *     "Age 3 to 5 (Early Childhood)"
 *   for the disability categories "All Disabilities", "Autism", "Other health
 *   impairment" and "Specific learning disability".
 *
 * Suppression is preserved, not filled. ED marks cells "-" (not available),
 * "x" (suppressed, small cell) and "*" (suppressed, data quality). Every one of
 * those becomes null here and the pages say "not published" rather than
 * guessing.
 *
 * Usage:  node scripts/research/pull_idea_part_b_child_count.js
 * Writes: data/research/education/idea_part_b_child_count_2024_25.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'research', 'education', 'idea_part_b_child_count_2024_25.json');

const DATASET_ID = '71ca7d0c-a161-4abe-9e2b-4e68ffb1061a';
const RESOURCE_ID = 'fdc6eb2c-4a4e-44ef-8b3d-01e68671e47c';
const CSV_URL =
  `https://data.ed.gov/dataset/${DATASET_ID}/resource/${RESOURCE_ID}/download/bchildcountandedenvironment2024-25.csv`;

const CATEGORIES = ['All Disabilities', 'Autism', 'Other health impairment', 'Specific learning disability'];

// The header is not the first line: ED ships four notes rows and a blank one.
const HEADER_LINE_INDEX = 5;

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// "-", "x" and "*" are ED's suppression flags. They stay null.
function count(raw) {
  const v = String(raw == null ? '' : raw).trim().replace(/,/g, '');
  if (!v || v === '-' || v === 'x' || v === '*') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchCsv() {
  const res = await fetch(CSV_URL, {
    headers: {
      // data.ed.gov refuses the default Node user agent with a 403.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Accept: 'text/csv,*/*',
    },
  });
  if (!res.ok) throw new Error(`data.ed.gov returned ${res.status} for ${CSV_URL}`);
  return res.text();
}

function parse(csv) {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
  const header = splitCsvLine(lines[HEADER_LINE_INDEX]);
  if (header[1] !== 'State Name' || header[2] !== 'SEA Education Environment') {
    throw new Error(`header moved: got ${JSON.stringify(header.slice(0, 4))}`);
  }
  const idx = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`column not found: ${name}`);
    return i;
  };
  const iState = idx('State Name');
  const iEnv = idx('SEA Education Environment');
  const iCat = idx('SEA Disability Category');
  const iSchoolAge = idx('Ages 6-21');
  const iEarly = idx('Age 3 to 5 (Early Childhood)');

  const states = {};
  let rows = 0;
  for (let i = HEADER_LINE_INDEX + 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const cells = splitCsvLine(lines[i]);
    const cat = (cells[iCat] || '').trim();
    if (!CATEGORIES.includes(cat)) continue;
    const env = (cells[iEnv] || '').trim();
    const state = (cells[iState] || '').trim();
    if (!state) continue;
    const bucket = states[state] || (states[state] = { school_age_6_to_21: {}, early_childhood_3_to_5: {} });
    if (env === 'Total, School Age') bucket.school_age_6_to_21[cat] = count(cells[iSchoolAge]);
    else if (env === 'Total, Early Childhood') bucket.early_childhood_3_to_5[cat] = count(cells[iEarly]);
    else continue;
    rows += 1;
  }
  return { states, rows };
}

(async () => {
  const csv = await fetchCsv();
  const { states, rows } = parse(csv);
  const named = Object.keys(states).length;
  if (named < 50) throw new Error(`expected at least 50 reporting states, parsed ${named}`);

  const snapshot = {
    $schema: 'lkg-idea-part-b-child-count-v1',
    collection: 'IDEA Part B Child Count and Educational Environments',
    school_year: '2024-25',
    publisher: 'U.S. Department of Education, Office of Special Education Programs',
    system: 'EDPass',
    file_specifications: ['002', '089'],
    extraction_date: '2025-07-30',
    dataset_id: DATASET_ID,
    resource_id: RESOURCE_ID,
    source_url: CSV_URL,
    catalogue_url: `https://data.ed.gov/dataset/${DATASET_ID}`,
    pulled_at: new Date().toISOString(),
    counts_are: 'Children with disabilities served under IDEA Part B, as reported by the state education agency.',
    not_a_claim_about:
      'These are service counts, not evaluation counts, not referral counts and not prevalence. They say how many ' +
      'children a state served, not how many were assessed, how long an assessment took, or what any assessment found.',
    suppression: 'ED marks cells "-" (not available), "x" (small cell) and "*" (data quality). All three are null here.',
    rows_kept: rows,
    reporting_geographies: named,
    categories: CATEGORIES,
    states,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${named} geographies, ${rows} rows kept`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
