#!/usr/bin/env node
'use strict';
/**
 * Hard-fail (runs inside validate_core, per pack): neuroevalguides.com serves
 * people seeking an ADHD/autism EVALUATION and people seeking ADHD/autism
 * THERAPY (owner decision, 16 Oct 2026). On the neuro build this fails when
 *
 *   1. the homepage H1, <title> or meta description stops naming both
 *      evaluation and therapy;
 *   2. the hero loses either of its two primary buttons ("Find an evaluator",
 *      "Find ADHD or autism therapy"), or either stops leading to the state and
 *      city finder (#states, which must exist on the page);
 *   3. the homepage callback form's first field is not the Evaluation /
 *      Therapy / Both choice (name="service_needed"), the field the lead record
 *      and lead email carry for routing;
 *   4. /request-assistance/ loses that choice or the evaluation-or-therapy
 *      provider type;
 *   5. /for-providers/ stops saying evaluation and therapy practices both
 *      belong, with the three service tags.
 *
 * Hard-fail basis: each is the difference between a therapy seeker finding a
 * path on this site and leaving, or a lead arriving without the one answer the
 * buyer needs to route it. (Provider-card tags are checked per card by
 * coverage_rendering_contract.js; record booleans by
 * coverage_runtime_support_contract.js.)
 *
 * Before checking dist it runs its fixtures (tests/neuro/neuro_services.test.mjs),
 * so a check that can no longer fail fails here first.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const siteLeadForm = require('../lib/site_lead_form');
const neuroServices = require('../lib/neuro_services');

const ROOT = path.resolve(__dirname, '..', '..');

function strip(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
const namesBoth = (t) => /evaluat/i.test(t) && /therap/i.test(t);

function serviceSelectProblems(formHtml, where) {
  const problems = [];
  const firstControl = (formHtml.match(/<(select|input|textarea)\b(?![^>]*type="hidden")[^>]*>/i) || [])[0] || '';
  if (!/name="service_needed"/.test(firstControl)) problems.push(`${where}: first field is not the evaluation / therapy / both choice (name="service_needed")`);
  const sel = (formHtml.match(/<select[^>]*name="service_needed"[\s\S]*?<\/select>/i) || [])[0] || '';
  for (const [v] of neuroServices.SERVICE_CHOICES) {
    if (!new RegExp(`<option value="${v}"`).test(sel)) problems.push(`${where}: service choice has no "${v}" option`);
  }
  return problems;
}

function checkNeuroHomepage(html) {
  const doc = String(html || '');
  const problems = [];
  const title = strip((doc.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  if (!namesBoth(title)) problems.push(`<title> does not name evaluation and therapy: "${title}"`);
  const desc = (doc.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
  if (!namesBoth(desc)) problems.push(`meta description does not name evaluation and therapy: "${desc}"`);
  const hero = (doc.match(/<section[^>]*data-home-hero="true"[^>]*>[\s\S]*?<\/section>/i) || [])[0] || '';
  const h1 = strip((hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
  if (!namesBoth(h1)) problems.push(`H1 does not name evaluation and therapy: "${h1}"`);
  const ctas = Array.from(hero.matchAll(/<a\b[^>]*data-home-hero-cta="true"[^>]*>([\s\S]*?)<\/a>/gi)).map((m) => ({ tag: m[0], label: strip(m[1]), href: (m[0].match(/href="([^"]*)"/) || [])[1] || '' }));
  const evalCta = ctas.find((c) => /evaluat/i.test(c.label));
  const therapyCta = ctas.find((c) => /therap/i.test(c.label));
  if (!evalCta) problems.push('hero has no evaluation button');
  if (!therapyCta) problems.push('hero has no therapy button');
  for (const c of [evalCta, therapyCta].filter(Boolean)) {
    if (!/\bhp-btn--primary\b/.test(c.tag)) problems.push(`hero button "${c.label}" is not a primary button`);
    if (c.href !== '#states') problems.push(`hero button "${c.label}" leads to "${c.href}", not the state and city finder (#states)`);
  }
  if (!/id="states"/.test(doc)) problems.push('homepage has no state and city finder (id="states")');
  const form = (doc.match(/<form[^>]*data-home-callback-form="true"[^>]*>[\s\S]*?<\/form>/i) || [])[0];
  if (!form) problems.push('homepage has no callback form');
  else problems.push(...serviceSelectProblems(form, 'homepage callback form'));
  return problems;
}

function checkNeuroRequestPage(html) {
  const doc = String(html || '');
  const problems = [];
  const form = (doc.match(/<form[^>]*id="request-assistance-form"[^>]*>[\s\S]*?<\/form>/i) || [])[0];
  if (!form) return ['request page has no request-assistance form'];
  problems.push(...serviceSelectProblems(form, 'request page form'));
  // The neuro label is the first provider type and pre-selected (owner, 25 Oct 2026).
  const first = ((siteLeadForm.providerOptions(form) || [])[0]) || {};
  if (first.text !== neuroServices.NEURO_PROVIDER_TYPE || !first.selected || first.disabled) problems.push(`request page's first provider type is not "${neuroServices.NEURO_PROVIDER_TYPE}", pre-selected`);
  if (form.includes('<option>' + neuroServices.LEGACY_NEURO_PROVIDER_TYPE + '</option>')) problems.push('request page still offers the evaluation-only provider type');
  return problems;
}

function checkNeuroForProviders(html) {
  const doc = String(html || '');
  const sec = (doc.match(/<section[^>]*data-neuro-for-providers-services="true"[^>]*>[\s\S]*?<\/section>/i) || [])[0];
  if (!sec) return ['for-providers has no evaluation-and-therapy section'];
  const problems = [];
  if (!/evaluation practices/i.test(strip(sec)) || !/therapy practices/i.test(strip(sec))) problems.push('for-providers section does not name evaluation practices and therapy practices');
  for (const t of [neuroServices.TAG_EVALUATION, neuroServices.TAG_THERAPY, neuroServices.TAG_BOTH]) {
    if (!sec.includes(`data-provider-service-tag="${t}"`)) problems.push(`for-providers section does not show the "${t}" tag`);
  }
  if (!/\$249/.test(sec)) problems.push('for-providers section does not state the $249/month price');
  return problems;
}

function isNeuroSite(site) {
  return /(^|\/)neuro_v1\.json$/i.test(String((site && site.pageSetFile) || ''));
}

function selfTest() {
  const r = cp.spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests', 'neuro', 'neuro_services.test.mjs')], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`NEURO SERVICES FAIL: fixture self-test failed\n${(r.stdout || '').slice(-2500)}${(r.stderr || '').slice(-800)}`);
    process.exit(1);
  }
}

function run(opts) {
  const site = (opts && opts.site) || null;
  if (!(opts && opts.noSelfTest)) selfTest();
  if (!isNeuroSite(site)) return;
  const dist = path.join(ROOT, 'dist');
  const pages = [
    ['index.html', checkNeuroHomepage],
    [path.join('request-assistance', 'index.html'), checkNeuroRequestPage],
    [path.join('for-providers', 'index.html'), checkNeuroForProviders]
  ];
  const problems = [];
  for (const [rel, check] of pages) {
    const f = path.join(dist, rel);
    if (!fs.existsSync(f)) { problems.push(`missing dist/${rel}`); continue; }
    problems.push(...check(fs.readFileSync(f, 'utf8')).map((p) => `${rel}: ${p}`));
  }
  if (problems.length) {
    console.error(`NEURO SERVICES FAIL:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('NEURO SERVICES CONTRACT PASS (homepage, request page, for-providers)');
}

module.exports = { run, checkNeuroHomepage, checkNeuroRequestPage, checkNeuroForProviders };

if (require.main === module) {
  let site = null;
  try { site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8')); } catch (_) { /* no site.json */ }
  run({ site });
}
