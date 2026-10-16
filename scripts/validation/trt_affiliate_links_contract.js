#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: affiliate links on hormonesivhair.com stay compliant (owner
 * decision, 16 Oct 2026; scripts/lib/trt_affiliates.js holds the programs).
 *
 * On the trt site it fails when
 *   1. an affiliate link (any href to ultalabtests.com or prescribedrx.com) is
 *      not inside a labelled affiliate block carrying the FTC disclosure;
 *   2. its rel is not "sponsored noopener" or it does not open in a new tab;
 *   3. an Ulta link is not a direct link to our microsite (a redirect wrapper,
 *      a relative /go/ path, another host, or a URL carried in a query string);
 *   4. a PrescribedRX link lacks ?ref=sequoialtaylor23 (exact);
 *   5. an affiliate block uses ranking language;
 *   6. the homepage does not name both TRT and menopause HRT in its H1, title
 *      and meta description, or lacks either program, or the callback has no
 *      women's HRT option; or a guide listed in GUIDE_BLOCKS lost its block;
 *   7. the site carries zero affiliate links (a check of nothing is not a pass).
 * On every OTHER site it fails when any affiliate link appears at all.
 *
 * Hard-fail basis: (1)(2)(5) are FTC / program-terms requirements; (3) breaks
 * Ulta's no-cloaking rule; (4) loses the commission silently; (6)(7) are the
 * owner's requirements going inert.
 *
 * Before checking dist it runs its own fixtures (tests/trt/trt_affiliates.test.mjs),
 * so a check that can no longer fail fails here first.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const aff = require('../lib/trt_affiliates');

const ROOT = path.resolve(__dirname, '..', '..');
const AFFILIATE_HOST_RE = /(^|\.)(ultalabtests\.com|prescribedrx\.com)$/i;
const RANKING_RE = /\b(best|top[- ]rated|#1|number one|leading|highest[- ]rated|ranked|ranking|top pick)\b/i;

function strip(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
function decode(s) { return String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'); }
function attr(tag, name) { const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"', 'i')); return m ? decode(m[1]) : null; }

/** Every <a> whose href points at, or carries, an affiliate domain. */
function affiliateAnchors(html) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(m[0], 'href');
    if (href == null) continue;
    let host = '';
    try { host = new URL(href, 'https://self.invalid/').hostname; } catch (_) { /* unparsable */ }
    const carries = /ultalabtests|prescribedrx/i.test(href);
    if (AFFILIATE_HOST_RE.test(host) || carries || m[0].includes('data-affiliate-link')) out.push({ tag: m[0], href, host, index: m.index });
  }
  return out;
}

/** Problems with the affiliate links on one trt page. */
function checkTrtPage(html) {
  const doc = String(html || '');
  const problems = [];
  const asides = Array.from(doc.matchAll(/<aside\b[^>]*data-affiliate-block="[^"]*"[^>]*>[\s\S]*?<\/aside>/gi)).map((m) => ({ start: m.index, end: m.index + m[0].length, html: m[0] }));
  for (const a of affiliateAnchors(doc)) {
    const where = a.href;
    const block = asides.find((b) => a.index > b.start && a.index < b.end);
    if (!block) { problems.push(`affiliate link outside a labelled affiliate block: ${where}`); continue; }
    const text = strip(block.html);
    if (!text.includes(aff.DISCLOSURE)) problems.push(`no FTC disclosure next to ${where}`);
    if (!text.includes(strip(aff.LABEL))) problems.push(`affiliate block around ${where} is not labelled "${aff.LABEL}"`);
    const after = block.html.slice(block.html.indexOf(a.tag) + a.tag.length);
    if (!/data-affiliate-disclosure="true"/.test(after)) problems.push(`disclosure does not follow ${where} in its block`);
    if (RANKING_RE.test(text)) problems.push(`ranking language in the affiliate block around ${where}: "${text.match(RANKING_RE)[0]}"`);
    const rel = (attr(a.tag, 'rel') || '').toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
    if (rel !== 'noopener sponsored') problems.push(`rel="${attr(a.tag, 'rel') || ''}" on ${where}, want "${aff.REL}"`);
    if (attr(a.tag, 'target') !== '_blank') problems.push(`${where} does not open in a new tab (target="_blank")`);
    let u = null;
    try { u = new URL(a.href); } catch (_) { /* relative or broken */ }
    const tagged = attr(a.tag, 'data-affiliate-link');
    const program = tagged === 'ulta' || tagged === 'prescribedrx' ? tagged : (/ultalabtests/i.test(a.href) ? 'ulta' : 'prescribedrx');
    if (tagged !== program || (/ultalabtests/i.test(a.href) && program !== 'ulta') || (/prescribedrx/i.test(a.href) && program !== 'prescribedrx')) problems.push(`${where} is not tagged data-affiliate-link="${program}" for click logging`);
    if (program === 'ulta') {
      const direct = u && u.protocol === 'https:' && u.hostname === 'www.ultalabtests.com' &&
        (a.href === aff.ULTA_MICROSITE || a.href.startsWith(aff.ULTA_PARTNER_PREFIX)) && !u.search && !/ultalabtests/i.test(u.pathname + u.hash);
      if (!direct) problems.push(`Ulta link is not a direct link to our microsite (no wrapper, no redirect): ${where}`);
    } else {
      const ok = u && u.protocol === 'https:' && /^(www\.)?prescribedrx\.com$/i.test(u.hostname) && u.searchParams.get('ref') === aff.PRESCRIBEDRX_REF && u.searchParams.getAll('ref').length === 1;
      if (!ok) problems.push(`PrescribedRX link lacks ?ref=${aff.PRESCRIBEDRX_REF} on prescribedrx.com: ${where}`);
    }
  }
  return problems;
}

function headTitle(doc) { return strip((String(doc).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]); }
function metaDesc(doc) { const m = String(doc).match(/<meta[^>]+name="description"[^>]*>/i); return m ? decode(attr(m[0], 'content') || '') : ''; }
function h1(doc) { return strip((String(doc).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]); }

/** The homepage names TRT and menopause HRT, carries both programs, and the callback welcomes women's HRT. */
function checkTrtHomepage(html) {
  const doc = String(html || '');
  const problems = [];
  for (const [what, text] of [['H1', h1(doc)], ['<title>', headTitle(doc)], ['meta description', metaDesc(doc)]]) {
    if (!/\bTRT\b|testosterone/i.test(text)) problems.push(`homepage ${what} does not name TRT: "${text}"`);
    if (!/menopaus/i.test(text) || !/\bHRT\b/i.test(text)) problems.push(`homepage ${what} does not name menopause HRT: "${text}"`);
  }
  const programs = new Set(affiliateAnchors(doc).map((a) => (/ultalabtests/i.test(a.href) ? 'ulta' : 'prescribedrx')));
  for (const p of ['ulta', 'prescribedrx']) if (!programs.has(p)) problems.push(`homepage has no ${p} affiliate link`);
  const form = (doc.match(/<form[^>]*data-home-callback-form="true"[\s\S]*?<\/form>/i) || [])[0] || '';
  if (!decode(form).includes('<option>' + aff.WOMENS_HRT_PROVIDER_TYPE + '</option>')) problems.push(`homepage callback has no "${aff.WOMENS_HRT_PROVIDER_TYPE}" option`);
  return problems;
}

function listHtml(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listHtml(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function isTrtSite(site) { return /(^|\/)trt_v1\.json$/i.test(String((site && site.pageSetFile) || '')); }

/** Checks a built dist directory. trt=true for hormonesivhair.com. */
function checkDist(dist, trt) {
  const problems = [];
  let links = 0;
  for (const f of listHtml(dist)) {
    const rel = path.relative(dist, f).replace(/\\/g, '/');
    const html = fs.readFileSync(f, 'utf8');
    const anchors = affiliateAnchors(html);
    links += anchors.length;
    if (!trt) { if (anchors.length) problems.push(`${rel}: affiliate link on a site with no affiliate program: ${anchors[0].href}`); continue; }
    problems.push(...checkTrtPage(html).map((p) => `${rel}: ${p}`));
  }
  if (trt) {
    const home = path.join(dist, 'index.html');
    if (!fs.existsSync(home)) problems.push('missing dist/index.html');
    else problems.push(...checkTrtHomepage(fs.readFileSync(home, 'utf8')).map((p) => `index.html: ${p}`));
    for (const [route, cfg] of Object.entries(aff.GUIDE_BLOCKS)) {
      const f = path.join(dist, route, 'index.html');
      if (!fs.existsSync(f)) { problems.push(`missing dist/${route}/index.html`); continue; }
      const html = fs.readFileSync(f, 'utf8');
      if (cfg.labs && !html.includes('data-affiliate-block="ulta"')) problems.push(`${route}: lost its "Check your levels first" block`);
      if (cfg.online && !html.includes('data-affiliate-block="prescribedrx"')) problems.push(`${route}: lost its "Prefer to start online?" block`);
      if (cfg.online && !/availability varies by state/i.test(html)) problems.push(`${route}: online block does not say testosterone availability varies by state`);
    }
    const ra = path.join(dist, 'request-assistance', 'index.html');
    if (fs.existsSync(ra) && !decode(fs.readFileSync(ra, 'utf8')).includes('<option>' + aff.WOMENS_HRT_PROVIDER_TYPE + '</option>')) problems.push(`request-assistance: no "${aff.WOMENS_HRT_PROVIDER_TYPE}" option`);
    if (links === 0) problems.push('the hormone site carries zero affiliate links');
  }
  return { problems, links };
}

function selfTest() {
  const r = cp.spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests', 'trt', 'trt_affiliates.test.mjs')], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`TRT AFFILIATE LINKS FAIL: fixture self-test failed\n${(r.stdout || '').slice(-2500)}${(r.stderr || '').slice(-800)}`);
    process.exit(1);
  }
}

function run(opts) {
  const site = (opts && opts.site) || null;
  if (!(opts && opts.noSelfTest)) selfTest();
  const trt = isTrtSite(site);
  const { problems, links } = checkDist(path.join(ROOT, 'dist'), trt);
  if (problems.length) {
    console.error(`TRT AFFILIATE LINKS FAIL:\n- ${problems.slice(0, 40).join('\n- ')}${problems.length > 40 ? `\n- ...and ${problems.length - 40} more` : ''}`);
    process.exit(1);
  }
  console.log(trt ? `TRT AFFILIATE LINKS CONTRACT PASS (${links} affiliate links, each disclosed)` : 'TRT AFFILIATE LINKS CONTRACT PASS (no affiliate links on this site)');
}

module.exports = { run, checkTrtPage, checkTrtHomepage, checkDist, affiliateAnchors };

if (require.main === module) {
  let site = null;
  try { site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8')); } catch (_) { /* no site.json */ }
  run({ site, noSelfTest: process.argv.includes('--no-selftest') });
}
