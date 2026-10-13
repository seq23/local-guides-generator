#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: every vertical id in the repo resolves through ONE table.
 *
 * data/contracts/velocity_vertical_aliases.json is the single source of
 * canonical vertical ids (`canonical`) and of every spelling that maps to one
 * (`aliases`). Before 13 Oct 2026 the generator, the seam validator and
 * apply_vertical_upgrade.sh each kept their own list, and uscis was missing
 * from one of them. This contract fails when:
 *   - any "vertical" value in a JSON file under data/ (which includes the
 *     generator's input, data/reference/ and data/velocity_intake/) or in a
 *     `vertical` CSV column under data/ does not resolve through `aliases`;
 *   - an alias points at an id that `canonical` does not define;
 *   - a canonical id has no alias to itself, no guide folder on disk, or a
 *     pack key scripts/lib/pack_site_config.js does not know;
 *   - apply_vertical_upgrade.sh leaves a canonical id with no accepted
 *     spelling, accepts a spelling the table does not resolve, or names one
 *     with no scripts/verticals/<name>.sh.
 * It also fails if it found no vertical values at all: a scan that reads
 * nothing cannot vouch for anything.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TABLE = path.join(ROOT, 'data', 'contracts', 'velocity_vertical_aliases.json');
const problems = [];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(json|csv)$/.test(e.name)) out.push(full);
  }
  return out;
}

function collect(value, file, sink) {
  if (Array.isArray(value)) { value.forEach((v) => collect(v, file, sink)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (k === 'vertical' && typeof v === 'string' && v.trim()) sink.push({ value: v.trim(), file });
    collect(v, file, sink);
  }
}

function parseCsvVerticals(text, file, sink) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return;
  const head = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const i = head.indexOf('vertical');
  if (i < 0) return;
  for (const line of lines.slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
    const v = String(cells[i] || '').replace(/,$/, '').replace(/^"|"$/g, '').trim();
    if (v) sink.push({ value: v, file });
  }
}

function check(table, found, upgradeSh, packKeys, exists) {
  const out = [];
  const aliases = table.aliases || {};
  const canonical = table.canonical || {};
  if (!Object.keys(canonical).length) out.push('velocity_vertical_aliases.json has no `canonical` table');
  for (const [alias, target] of Object.entries(aliases)) {
    if (!canonical[target]) out.push(`alias "${alias}" -> "${target}", which is not a canonical id`);
  }
  for (const [id, c] of Object.entries(canonical)) {
    if (aliases[id] !== id) out.push(`canonical id "${id}" has no alias to itself`);
    if (!c.pack_key || !packKeys.includes(c.pack_key)) out.push(`canonical id "${id}" names pack key "${c.pack_key}", unknown to scripts/lib/pack_site_config.js`);
    else if (aliases[c.pack_key] !== id) out.push(`pack key "${c.pack_key}" does not resolve to canonical id "${id}"`);
    if (!c.global_pages_dir || !exists(c.global_pages_dir)) out.push(`canonical id "${id}" guide folder ${c.global_pages_dir} does not exist`);
  }
  for (const u of table.upstream_verticals || []) if (!aliases[u]) out.push(`upstream vertical "${u}" does not resolve`);
  const unresolved = new Map();
  for (const f of found) if (!aliases[f.value]) unresolved.set(f.value, f.file);
  for (const [v, file] of unresolved) out.push(`vertical "${v}" in ${file} does not resolve through velocity_vertical_aliases.json`);
  const m = String(upgradeSh).match(/case "\$VERTICAL" in\s*\n\s*([a-z_|-]+)\)/);
  if (!m) out.push('apply_vertical_upgrade.sh allowlist (case "$VERTICAL" in ...) not found');
  else {
    const allowed = m[1].split('|');
    const covered = new Set(allowed.map((a) => aliases[a]).filter(Boolean));
    for (const id of Object.keys(canonical)) if (!covered.has(id)) out.push(`apply_vertical_upgrade.sh accepts no spelling of canonical id "${id}"`);
    for (const a of allowed) {
      if (!aliases[a]) out.push(`apply_vertical_upgrade.sh accepts "${a}", which does not resolve`);
      if (!exists(`scripts/verticals/${a}.sh`)) out.push(`apply_vertical_upgrade.sh accepts "${a}" but scripts/verticals/${a}.sh is missing`);
    }
  }
  return out;
}

const table = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
const found = [];
for (const file of walk(path.join(ROOT, 'data'))) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) { try { collect(JSON.parse(text), rel, found); } catch { /* not JSON data */ } }
  else parseCsvVerticals(text, rel, found);
}
const { PACK_SITE_CONFIG } = require('../lib/pack_site_config');
const packKeys = Object.keys(PACK_SITE_CONFIG);
const upgradeSh = fs.readFileSync(path.join(ROOT, 'apply_vertical_upgrade.sh'), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

if (!found.length) problems.push('found no "vertical" values under data/; the scan read nothing');
problems.push(...check(table, found, upgradeSh, packKeys, exists));

// Negative proof, every run: an unmapped spelling must be caught.
const hostile = check(table, [{ value: 'senior living', file: '(negative proof)' }], upgradeSh, packKeys, exists);
if (!hostile.some((p) => p.includes('"senior living"'))) problems.push('negative proof no longer caught: unmapped vertical spelling');

if (problems.length) {
  console.error('VERTICAL ID ALIAS CONTRACT FAIL');
  problems.slice(0, 40).forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
const distinct = new Set(found.map((f) => f.value));
console.log(`✅ VERTICAL ID ALIAS CONTRACT PASS (${found.length} vertical values, ${distinct.size} spellings, all resolve to ${Object.keys(table.canonical).length} canonical ids)`);
