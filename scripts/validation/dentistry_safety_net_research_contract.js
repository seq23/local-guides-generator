#!/usr/bin/env node
/**
 * Dentistry safety-net research contract.
 *
 * The dentistry pack indexes a city page only when a research file exists for it
 * (build_city_sites.js stamps data-template-fallback otherwise, and
 * apply_robots_policy.js noindexes on that stamp). promoted_city_research_contract.js
 * checks that such a file EXISTS; it cannot tell a researched page from
 * boilerplate. That gap is what kept dentistry latent on 2026-08-27. This contract
 * closes it for the axis that was built on 2026-10-09:
 *
 *   1. Every dentistry research file (= every indexed dentistry city page) carries
 *      safety_net_access with at least MIN_ENTRIES entries in BOTH sections:
 *      free_low_cost and dental_school.
 *   2. Every entry names the clinic, has a source_url (https) and a fetched_on
 *      date, plus the access facts the page renders (eligibility, services, how to
 *      get seen, and a phone or address). Every additional source has a URL and a date.
 *   3. No dollar figure without a source: a $ figure may appear only inside an
 *      entry that carries its source; anywhere else in a dentistry research file it fails.
 *   4. Every research file belongs to a page the build actually produces (a file
 *      with no page is how houston-tx and miami-fl sat unpublished until 2026-10-09).
 *   5. data/research/dentistry/vertical_status.json "measurements" equals a fresh
 *      run of scripts/research/measure_dentistry_vertical_status.js.
 *   6. When run inside the dentistry pack build (PAGE_SET_FILE names dentistry and
 *      LKG_VALIDATE_DIST=1), the rendered pages agree: each researched city is
 *      index,follow, has no template-fallback stamp, carries both section anchors
 *      and renders exactly as many entries as its file holds; every page that
 *      does carry the fallback stamp is noindex.
 *
 * Hard-fails on zero researched pages: a contract that passes over nothing is not a pass.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { measure, SECTION_KEYS, DOLLAR_FIGURE, STATUS } = require('../research/measure_dentistry_vertical_status.js');

const ROOT = path.resolve(__dirname, '..', '..');
const RESEARCH_DIR = path.join(ROOT, 'data', 'city_content', 'dentistry');
const MIN_ENTRIES = 3;
const REQUIRED_TEXT = ['name', 'eligibility', 'services', 'how_to_get_seen'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\/[^\s]+\.[^\s]+/;

const failures = [];
const fail = (msg) => failures.push(msg);

function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

const m = measure();
const files = m.research_files_present;
if (!files.length) {
  console.error('DENTISTRY SAFETY-NET RESEARCH CONTRACT FAIL: zero dentistry research files - nothing to check is not a pass.');
  process.exit(1);
}

let entriesChecked = 0;
for (const slug of files) {
  const rel = `data/city_content/dentistry/${slug}.json`;
  const doc = JSON.parse(fs.readFileSync(path.join(RESEARCH_DIR, `${slug}.json`), 'utf8'));
  const sna = doc.safety_net_access;
  if (!sna || typeof sna !== 'object') { fail(`${rel}: no safety_net_access block - an indexed dentistry page must answer the safety-net queries`); continue; }
  if (!DATE.test(String(sna.researched_on || ''))) fail(`${rel}: safety_net_access.researched_on must be YYYY-MM-DD`);

  // Rule 3, outside entries: the rest of the file has no source to stand on.
  const { safety_net_access: _sna, ...rest } = doc;
  const { free_low_cost: _a, dental_school: _b, ...snaMeta } = sna;
  for (const s of collectStrings([rest, snaMeta], [])) {
    if (DOLLAR_FIGURE.test(s)) fail(`${rel}: dollar figure outside a sourced entry: "${s.slice(0, 80)}"`);
  }

  for (const key of SECTION_KEYS) {
    const entries = Array.isArray(sna[key]) ? sna[key] : [];
    if (entries.length < MIN_ENTRIES) fail(`${rel}: safety_net_access.${key} has ${entries.length} entries; an indexed page needs at least ${MIN_ENTRIES}`);
    entries.forEach((e, i) => {
      entriesChecked += 1;
      const where = `${rel}: ${key}[${i}] ${e && e.name ? `(${e.name})` : ''}`;
      if (!e || typeof e !== 'object') { fail(`${where}: not an object`); return; }
      for (const f of REQUIRED_TEXT) if (!String(e[f] || '').trim()) fail(`${where}: missing ${f}`);
      if (!String(e.phone || '').trim() && !String(e.address || '').trim()) fail(`${where}: needs a phone or an address`);
      if (!HTTPS.test(String(e.source_url || ''))) fail(`${where}: source_url missing or not https`);
      if (!DATE.test(String(e.fetched_on || ''))) fail(`${where}: fetched_on missing or not YYYY-MM-DD`);
      if (e.url && !HTTPS.test(String(e.url))) fail(`${where}: url is not https`);
      (Array.isArray(e.additional_sources) ? e.additional_sources : []).forEach((src, j) => {
        if (!src || !HTTPS.test(String(src.url || ''))) fail(`${where}: additional_sources[${j}] has no https url`);
        if (!src || !DATE.test(String(src.fetched_on || ''))) fail(`${where}: additional_sources[${j}] has no fetched_on date`);
      });
      // Rule 3, inside entries: a $ figure needs the entry's own source behind it.
      const hasDollar = collectStrings(e, []).some((s) => DOLLAR_FIGURE.test(s));
      if (hasDollar && !HTTPS.test(String(e.source_url || ''))) fail(`${where}: dollar figure with no source_url`);
    });
  }
}

// Rule 4.
for (const slug of m.research_files_without_a_page) fail(`data/city_content/dentistry/${slug}.json has no page in the build (add it to the dentistry page set or remove the file)`);

// Rule 5.
let status;
try { status = JSON.parse(fs.readFileSync(STATUS, 'utf8')); } catch (e) { fail(`${path.relative(ROOT, STATUS)} unreadable: ${e.message}`); }
if (status) {
  const stored = JSON.stringify(status.measurements || null);
  const fresh = JSON.stringify(m);
  if (stored !== fresh) fail(`${path.relative(ROOT, STATUS)} "measurements" is stale - re-run: node scripts/research/measure_dentistry_vertical_status.js --write`);
}

// Rule 6.
let pagesChecked = 0;
const pageSet = String(process.env.PAGE_SET_FILE || '');
const distDir = path.resolve(ROOT, process.env.PAGES_OUT_DIR || 'dist');
if (process.env.LKG_VALIDATE_DIST === '1' && /dentistry/.test(pageSet) && fs.existsSync(distDir)) {
  for (const slug of files) {
    const file = path.join(distDir, slug, 'index.html');
    if (!fs.existsSync(file)) { fail(`dist/${slug}/index.html was not built`); continue; }
    pagesChecked += 1;
    const html = fs.readFileSync(file, 'utf8');
    const robots = (html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || [])[1] || '';
    if (!/^index,follow/i.test(robots)) fail(`dist/${slug}/: researched page is not index,follow (robots="${robots}")`);
    if (/data-template-fallback=["']true["']/i.test(html)) fail(`dist/${slug}/: researched page still carries the template-fallback stamp`);
    const doc = JSON.parse(fs.readFileSync(path.join(RESEARCH_DIR, `${slug}.json`), 'utf8'));
    const expected = SECTION_KEYS.reduce((n, k) => n + ((doc.safety_net_access || {})[k] || []).length, 0);
    for (const id of ['free-low-cost-dental-clinics', 'dental-school-clinics']) {
      if (!html.includes(`id="${id}"`)) fail(`dist/${slug}/: missing #${id} section`);
    }
    const rendered = (html.match(/data-safety-net-entry="true"/g) || []).length;
    if (rendered !== expected) fail(`dist/${slug}/: rendered ${rendered} safety-net entries, research file has ${expected}`);
    const sourced = (html.match(/data-safety-net-source="true"/g) || []).length;
    if (sourced !== rendered) fail(`dist/${slug}/: ${rendered - sourced} rendered entries have no source line`);
  }
  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(distDir, entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (/data-template-fallback=["']true["']/i.test(html) && !/name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
      fail(`dist/${entry.name}/: templated page is indexable`);
    }
  }
  if (!pagesChecked) fail('dentistry dist present but zero researched pages were checked');
}

if (failures.length) {
  console.error(`DENTISTRY SAFETY-NET RESEARCH CONTRACT FAIL: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`DENTISTRY SAFETY-NET RESEARCH CONTRACT PASS: ${files.length} researched pages, ${entriesChecked} sourced entries${pagesChecked ? `, ${pagesChecked} rendered pages checked` : ''}`);
