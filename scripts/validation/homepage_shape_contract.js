#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the canonical homepage keeps the owner-approved shape (14 Oct 2026).
 *
 * Fails the rendered dist/index.html when
 *   1. the first H2 after the hero is about the site itself (names the brand,
 *      "this site", or opens "About") instead of the reader's topic - the
 *      "What is <Brand>, and when should you use it?" box this layout removed;
 *   2. its FAQPage JSON-LD carries fewer than 4 questions, or carries a question
 *      the page does not show (schema must match what a reader sees);
 *   3. it has no providers section (data-home-provider-preview with at least one
 *      named provider card).
 *
 * Hard-fail basis: each is a real harm, not a style rule. (1) puts a sentence
 * about us where search and answer engines read the page's topic; (2) a
 * one-question FAQPage is the shape this layout replaced, and a question in
 * schema that is not on the page is markup Google treats as spam; (3) the
 * provider examples are the page's only concrete local proof and the path to
 * the callback form.
 *
 * Before checking dist it runs its own fixtures (tests/homepage/
 * homepage_shape.test.mjs: the old shape must fail, the new shape must pass), so
 * a check that has stopped being able to fail fails here first.
 *
 * Usage: node scripts/validation/homepage_shape_contract.js [file.html --brand "Name"]
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function strip(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }

function faqQuestions(html) {
  const qs = [];
  for (const b of String(html).matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let v;
    try { v = JSON.parse(b[1]); } catch (_) { continue; }
    for (const n of (Array.isArray(v) ? v : [v])) {
      if (n && n['@type'] === 'FAQPage') for (const q of [].concat(n.mainEntity || [])) if (q && q.name) qs.push(String(q.name));
    }
  }
  return qs;
}

function checkHomepageShape(html, brand) {
  const problems = [];
  const doc = String(html || '');
  const main = (doc.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || doc;
  const hero = main.match(/<section[^>]*class="[^"]*\bhero\b[^"]*"[^>]*>[\s\S]*?<\/section>/i);
  if (!hero) problems.push('no hero section');
  const after = hero ? main.slice(main.indexOf(hero[0]) + hero[0].length) : main;
  const h2 = after.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (!h2) problems.push('no H2 after the hero');
  else {
    const t = strip(h2[1]);
    const b = String(brand || '').trim().toLowerCase();
    if ((b && t.toLowerCase().includes(b)) || /\bthis site\b/i.test(t) || /^about\b/i.test(t)) {
      problems.push(`first H2 after the hero is about the site, not the topic: "${t}"`);
    }
  }
  const qs = faqQuestions(doc);
  if (qs.length < 4) problems.push(`FAQPage carries ${qs.length} question(s), need at least 4`);
  const visible = strip(main).toLowerCase();
  const unseen = qs.filter((q) => !visible.includes(strip(q).toLowerCase()));
  if (unseen.length) problems.push(`FAQPage question(s) not shown on the page: ${unseen.map((q) => `"${q}"`).join(', ')}`);
  const prov = main.match(/<section[^>]*data-home-provider-preview="true"[^>]*>[\s\S]*?<\/section>/i);
  if (!prov) problems.push('no providers section (data-home-provider-preview)');
  else if (!/<h3[^>]*>\s*[^<\s][^<]*<\/h3>/i.test(prov[0])) problems.push('providers section names no provider');
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  let file = path.join(ROOT, 'dist', 'index.html');
  let brand = '';
  if (args[0] && !args[0].startsWith('--')) file = path.resolve(args[0]);
  const bi = args.indexOf('--brand');
  if (bi >= 0) brand = args[bi + 1] || '';
  else {
    try { brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8')).brandName || ''; } catch (_) { /* no site.json */ }
  }
  if (!args.includes('--no-selftest')) {
    const r = cp.spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests', 'homepage', 'homepage_shape.test.mjs')], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`HOMEPAGE SHAPE FAIL: fixture self-test failed\n${(r.stdout || '').slice(-1500)}${(r.stderr || '').slice(-800)}`);
      process.exit(1);
    }
  }
  if (!fs.existsSync(file)) { console.error(`HOMEPAGE SHAPE FAIL: ${file} missing`); process.exit(1); }
  if (!brand) { console.error('HOMEPAGE SHAPE FAIL: no brand name to check the first H2 against'); process.exit(1); }
  const problems = checkHomepageShape(fs.readFileSync(file, 'utf8'), brand);
  if (problems.length) {
    console.error(`HOMEPAGE SHAPE FAIL (${brand}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`HOMEPAGE SHAPE CONTRACT PASS (${brand}, ${faqQuestions(fs.readFileSync(file, 'utf8')).length} FAQ questions)`);
}

module.exports = { checkHomepageShape, faqQuestions };
if (require.main === module) main();
