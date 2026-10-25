#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: every guide site's lead forms open on THAT site's own service, and
 * every lead names the site and the page it came from (owner, 25 Oct 2026).
 *
 * The first neuroevalguides.com lead reached the shared Airtable table as
 * "Personal Injury Attorney": the site's /request-assistance/ page opened on a
 * blank "Select one" with Personal Injury first, and its vertical_key was blank.
 *
 * On each of the five guide sites (pi, dentistry, neuro, trt, uscis_medical) it
 * fails when, on the homepage callback form or the /request-assistance/ form,
 *   1. the first provider_type option is not the site's own service, or is not
 *      pre-selected, or a blank / disabled default is offered;
 *   2. a site's own service is missing, or the other services are no longer
 *      listed below it (owner: keep them);
 *   3. the hidden vertical_key is not the site's key;
 *   4. the request page's script, run against the built page, blanks
 *      vertical_key or leaves src / page_slug / button_source without the page
 *      the visitor came from (the link's query, else document.referrer);
 *   5. functions/api/request-assistance.js does not accept one of the site's
 *      own provider types.
 *
 * Hard-fail basis: a lead filed under another business is a lost lead.
 *
 * Before checking dist it runs its own fixtures
 * (tests/request_form/own_vertical.test.mjs), so a check that can no longer
 * fail fails here first.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const siteLeadForm = require('../lib/site_lead_form');
const { getPackKeyFromPageSet } = require('../lib/pack_site_config');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'functions', 'api', 'request-assistance.js');

function allowedProviderTypes(src) {
  const m = String(src || '').match(/const ALLOWED_PROVIDER_TYPES = new Set\(\[([\s\S]*?)\]\);/);
  if (!m) return [];
  return Array.from(m[1].replace(/\/\/[^\n]*/g, '').matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)).map((x) => (x[1] != null ? x[1] : x[2]).replace(/\\'/g, "'"));
}

function hiddenValue(formHtml, name) {
  const tag = (String(formHtml || '').match(new RegExp('<input\\b[^>]*\\bname="' + name + '"[^>]*>', 'i')) || [])[0];
  if (!tag) return null;
  return ((tag.match(/\bvalue="([^"]*)"/i) || [])[1]) || '';
}

/** Problems with one form's provider select and vertical_key. */
function checkForm(formHtml, vk, where) {
  const own = siteLeadForm.ownProviderTypes(vk);
  const problems = [];
  const opts = siteLeadForm.providerOptions(formHtml);
  if (!opts || !opts.length) return [`${where}: no provider_type select`];
  const first = opts[0];
  if (first.text !== own[0] || !first.selected || first.disabled) problems.push(`${where}: first provider type is "${first.text}"${first.selected ? '' : ' (not pre-selected)'}, not "${own[0]}" pre-selected`);
  const blank = opts.find((o) => o.disabled || !o.text || o.value === '');
  if (blank) problems.push(`${where}: offers a blank default "${blank.text}"`);
  const selected = opts.filter((o) => o.selected);
  if (selected.length !== 1) problems.push(`${where}: ${selected.length} options pre-selected, expected 1`);
  opts.slice(0, own.length).forEach((o, i) => { if (o.text !== own[i]) problems.push(`${where}: own service "${own[i]}" is not listed at position ${i + 1}`); });
  if (opts.length <= own.length) problems.push(`${where}: the other services are no longer listed below the site's own`);
  const v = hiddenValue(formHtml, 'vertical_key');
  if (v !== vk) problems.push(`${where}: vertical_key is "${v == null ? '(missing)' : v}", not "${vk}"`);
  return problems;
}

/** Runs the request page's inline script against a stub DOM; returns the hidden values. */
function runRequestPageScript(pageHtml, { href, referrer }) {
  const doc = String(pageHtml || '');
  const form = (doc.match(/<form[^>]*id="request-assistance-form"[^>]*>[\s\S]*?<\/form>/i) || [])[0] || '';
  const scripts = Array.from(doc.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[1]).filter((s) => s.includes("getElementById('vertical_key')") || s.includes('paramMap'));
  if (!scripts.length) throw new Error('request page has no attribution script');
  const els = {};
  for (const m of form.matchAll(/<input\b[^>]*\btype="hidden"[^>]*>/gi)) {
    const id = (m[0].match(/\bid="([^"]+)"/) || [])[1];
    if (id) els[id] = { value: (m[0].match(/\bvalue="([^"]*)"/) || [])[1] || '', setAttribute() {} };
  }
  const document = { referrer: referrer || '', getElementById: (id) => els[id] || null, createElement: () => ({}) };
  const window = { location: new URL(href) };
  window.location.href = href;
  vm.runInNewContext(scripts[0], { document, window, URL, console });
  return Object.fromEntries(Object.entries(els).map(([k, v]) => [k, v.value]));
}

function checkRequestPageAttribution(pageHtml, vk, siteUrl) {
  const problems = [];
  const origin = siteUrl || 'https://example.test';
  let r;
  try {
    // Landed directly from a city page on the same site, no query.
    r = runRequestPageScript(pageHtml, { href: origin + '/request-assistance/', referrer: origin + '/states/MA/boston/' });
  } catch (e) { return [`request page: attribution script failed: ${e.message}`]; }
  if (r.vertical_key !== vk) problems.push(`request page: a direct visit leaves vertical_key "${r.vertical_key}", not "${vk}"`);
  if (r.src !== '/states/MA/boston/') problems.push(`request page: a direct visit from /states/MA/boston/ leaves src "${r.src}"`);
  if (r.page_slug !== '/states/MA/boston/') problems.push(`request page: a direct visit from /states/MA/boston/ leaves page_slug "${r.page_slug}"`);
  if (!r.button_source) problems.push('request page: a direct visit leaves button_source blank');
  // No referrer at all.
  r = runRequestPageScript(pageHtml, { href: origin + '/request-assistance/', referrer: '' });
  if (r.vertical_key !== vk) problems.push(`request page: a visit with no referrer leaves vertical_key "${r.vertical_key}"`);
  if (!r.src) problems.push('request page: a visit with no referrer leaves src blank');
  // Arrived through a tagged link: the query wins, and a link without vertical keeps the site's.
  r = runRequestPageScript(pageHtml, { href: origin + '/request-assistance/?src=%2Fguides%2Fx%2F&button=guide_cta&page_slug=guides-x', referrer: origin + '/guides/x/' });
  if (r.src !== '/guides/x/' || r.button_source !== 'guide_cta' || r.page_slug !== 'guides-x') problems.push(`request page: a tagged link's src/button/page_slug did not win (${r.src} / ${r.button_source} / ${r.page_slug})`);
  if (r.vertical_key !== vk) problems.push(`request page: a link without vertical blanks vertical_key ("${r.vertical_key}")`);
  return problems;
}

function checkApiAccepts(vk, fnSrc) {
  const allowed = allowedProviderTypes(fnSrc);
  if (!allowed.length) return ['functions/api/request-assistance.js: ALLOWED_PROVIDER_TYPES not found'];
  return siteLeadForm.ownProviderTypes(vk).filter((t) => !allowed.includes(t)).map((t) => `functions/api/request-assistance.js rejects this site's own provider type "${t}"`);
}

function checkDist(dist, vk, siteUrl) {
  const problems = [];
  const home = path.join(dist, 'index.html');
  const ra = path.join(dist, 'request-assistance', 'index.html');
  if (!fs.existsSync(home)) problems.push('missing dist/index.html');
  else {
    const form = (fs.readFileSync(home, 'utf8').match(/<form[^>]*data-home-callback-form="true"[^>]*>[\s\S]*?<\/form>/i) || [])[0];
    if (!form) problems.push('homepage has no callback form');
    else problems.push(...checkForm(form, vk, 'homepage callback form'));
  }
  if (!fs.existsSync(ra)) problems.push('missing dist/request-assistance/index.html');
  else {
    const page = fs.readFileSync(ra, 'utf8');
    const form = (page.match(/<form[^>]*id="request-assistance-form"[^>]*>[\s\S]*?<\/form>/i) || [])[0];
    if (!form) problems.push('request page has no request-assistance form');
    else problems.push(...checkForm(form, vk, 'request page form'));
    problems.push(...checkRequestPageAttribution(page, vk, siteUrl));
  }
  problems.push(...checkApiAccepts(vk, fs.readFileSync(FN, 'utf8')));
  return problems;
}

function selfTest() {
  const r = cp.spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests', 'request_form', 'own_vertical.test.mjs')], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`REQUEST FORM OWN VERTICAL FAIL: fixture self-test failed\n${(r.stdout || '').slice(-2500)}${(r.stderr || '').slice(-800)}`);
    process.exit(1);
  }
}

function run(opts) {
  const site = (opts && opts.site) || null;
  if (!(opts && opts.noSelfTest)) selfTest();
  const vk = getPackKeyFromPageSet(site && site.pageSetFile);
  if (!siteLeadForm.ownProviderTypes(vk)) return;
  const problems = checkDist(path.join(ROOT, 'dist'), vk, site && site.siteUrl);
  if (problems.length) {
    console.error(`REQUEST FORM OWN VERTICAL FAIL (${vk}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`REQUEST FORM OWN VERTICAL CONTRACT PASS (${vk}: homepage + request page open on the site's own service; vertical_key and source page set)`);
}

module.exports = { run, checkForm, checkRequestPageAttribution, checkApiAccepts, checkDist, allowedProviderTypes, runRequestPageScript };

if (require.main === module) {
  let site = null;
  try { site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8')); } catch (_) { /* no site.json */ }
  run({ site, noSelfTest: process.argv.includes('--no-selftest') });
}
