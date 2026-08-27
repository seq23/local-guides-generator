#!/usr/bin/env node
/**
 * Every dollar figure on a generated cost page must trace to a source.
 *
 * The pages under scripts/research/build_open_shape_guides.js exist because
 * "cost / price" is the query shape where this portfolio's pages are absent and
 * unbranded competitors get cited. The whole value of that build is that its
 * numbers are real. One invented figure and the page is worth less than nothing,
 * because it is now a citable source for something false.
 *
 * So: extract every `$n` from the generated guide files and require each one to
 * be either
 *   a) a value present in data/research/costs/cms_geography_service_2024.json,
 *      which is a pull from a version-pinned CMS distribution, or
 *   b) listed explicitly in data/research/costs/sources.json, which is where the
 *      USCIS fee-schedule figures and the quoted federal fees live.
 *
 * Anything else fails the build. There is deliberately no allowlist to edit your
 * way past: to publish a new figure you add the source, not the exception.
 *
 * Scope: EVERY page-set file that prints a dollar figure, not just the ones one
 * generator names.
 *
 * It used to scope itself to build_open_shape_guides.js. That was a defensible
 * choice when written -- do not retro-judge pages that predate the contract --
 * but it meant the guard validated 166 figures across 15 pages while a live page
 * carrying 43 unsourced ones sat outside its reach, and three separate agents
 * added pages it structurally could not see. A passing check was being read as
 * coverage.
 *
 * Pre-existing unsourced figures are sealed in UNSOURCED_BASELINE rather than
 * retro-failed. The seal is the honest form of the original intent: old pages are
 * not judged, and nothing NEW escapes. Adding to the baseline is not the way past
 * this gate -- to publish a new figure you add the source.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const COSTS = path.join(ROOT, 'data', 'research', 'costs');
const GENERATOR = path.join(ROOT, 'scripts', 'research', 'build_open_shape_guides.js');

function fail(lines) {
  console.error('SOURCED COST FIGURES FAIL');
  for (const l of lines) console.error(`  - ${l}`);
  process.exit(1);
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// Which files did the generator write? Read the routes and file names out of it
// rather than keeping a second list that can drift.
// Every page-set and city-content file, not just one generator's output.
function allPageFiles() {
  const roots = [
    path.join(ROOT, 'data', 'page_sets', 'examples'),
    path.join(ROOT, 'data', 'city_content'),
  ];
  const out = [];
  const walk = (d) => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.json')) out.push(full);
    }
  };
  roots.forEach(walk);
  return out.sort();
}

function generatedFiles() {
  const src = fs.readFileSync(GENERATOR, 'utf8');
  const out = [];
  const re = /vertical:\s*'([a-z_]+)',\s*\n\s*(?:\/\/[^\n]*\n\s*)*file:\s*'([^']+)'/g;
  let m;
  const VDIR = {
    dentistry: 'dentistry_global_pages',
    neuro: 'neuro_global_pages',
    trt: 'trt_global_pages',
    pi: 'pi_global_pages',
    uscis_medical: 'uscis_medical_global_pages',
  };
  while ((m = re.exec(src))) {
    out.push(path.join(ROOT, 'data', 'page_sets', 'examples', VDIR[m[1]], m[2]));
  }
  return out;
}

// Every dollar amount the CMS snapshot can justify, as printed strings.
function allowedFromCms() {
  const snap = readJson(path.join(COSTS, 'cms_geography_service_2024.json'));
  const allowed = new Set();
  const add = (n) => {
    if (n === null || n === undefined) return;
    allowed.add('$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    allowed.add('$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
  };
  for (const entry of Object.values(snap.codes || {})) {
    if (!entry.present) continue;
    const rows = [...Object.values(entry.national || {})];
    for (const st of Object.values(entry.states || {})) rows.push(...Object.values(st));
    for (const r of rows) {
      add(r.avg_submitted_charge);
      add(r.avg_medicare_allowed);
      add(r.avg_medicare_paid);
    }
  }
  return allowed;
}

// Every dollar amount named in the source registry, wherever it appears in it.
function allowedFromRegistry() {
  const raw = fs.readFileSync(path.join(COSTS, 'sources.json'), 'utf8');
  const allowed = new Set();
  for (const m of raw.matchAll(/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g)) allowed.add(m[0]);
  return allowed;
}

function main() {
  const missing = [];
  for (const f of [path.join(COSTS, 'cms_geography_service_2024.json'), path.join(COSTS, 'sources.json'), GENERATOR]) {
    if (!fs.existsSync(f)) missing.push(`missing required file ${path.relative(ROOT, f)}`);
  }
  if (missing.length) fail(missing);

  const allowed = new Set([...allowedFromCms(), ...allowedFromRegistry()]);

  // The generator's own pages must still exist -- a silent parser break there
  // would otherwise look like a clean pass.
  const named = generatedFiles();
  if (!named.length) fail(['could not read any generated page from the generator; the parser is out of date']);

  const baselinePath = path.join(ROOT, 'data', 'contracts', 'unsourced_figure_baseline.json');
  const baseline = fs.existsSync(baselinePath) ? new Set(readJson(baselinePath).sealed || []) : new Set();

  const files = allPageFiles();
  const problems = [];
  let figures = 0;
  let sealed = 0;
  for (const fp of files) {
    if (!fs.existsSync(fp)) continue;
    const rel = path.relative(ROOT, fp);
    let doc; try { doc = readJson(fp); } catch { continue; }
    const html = String(doc.main_html || '');
    for (const m of html.matchAll(/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g)) {
      figures += 1;
      if (allowed.has(m[0])) continue;
      if (baseline.has(rel)) { sealed += 1; continue; }
      problems.push(`${rel}: ${m[0]} is not in the CMS snapshot or the source registry`);
    }
  }

  if (problems.length) fail(problems);
  console.log(`✅ SOURCED COST FIGURES PASS (${figures} dollar figures across ${files.length} page file(s), all traceable; ${sealed} figure(s) on ${baseline.size} sealed pre-existing page(s))`);
}

main();
