#!/usr/bin/env node
'use strict';
/**
 * Hard-fail (AEO): the homepage carries exactly one 40-60 word definition
 * paragraph that opens "<Brand> is", and the WebPage node carries a
 * SpeakableSpecification whose every cssSelector resolves on the page and which
 * covers both the definition and the questions section.
 *
 * Rewritten for the owner-approved layout (14 Oct 2026). The H1 is now the
 * reader's question, followed directly by one subline (data-hero-subline), and
 * the definition sits in the About section (data-home-about-block). The pin is
 * no looser: the H1 must still be followed directly by a marked paragraph, the
 * definition must still be one marked paragraph of 40-60 words opening
 * "<Brand> is", and now must be the only one and must sit inside About; the
 * speakable selectors must equal the registry's list
 * (data/contracts/site_hygiene_registry.json speakable_selectors), which the
 * renderer also reads, so the two cannot drift.
 */
const fs = require('fs');
const path = require('path');
const { DIST, ROOT } = require('./lib_site_dist');

function fail(msg) { console.error(`HOMEPAGE DEFINITION FAIL: ${msg}`); process.exit(1); }

const fp = path.join(DIST, 'index.html');
if (!fs.existsSync(fp)) fail('index.html missing from output root');
const html = fs.readFileSync(fp, 'utf8');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const brand = String(site.brandName || '').trim();

const sub = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*(<p[^>]*>)/i);
if (!sub) fail('no paragraph directly after the H1');
if (!/data-hero-subline="true"/.test(sub[1])) fail(`element after the H1 is not the hero subline: ${sub[1]}`);
const defs = html.match(/<p[^>]*data-site-definition="true"[^>]*>[\s\S]*?<\/p>/gi) || [];
if (defs.length !== 1) fail(`expected exactly one definition paragraph, found ${defs.length}`);
const m = defs[0].match(/^(<p[^>]*>)([\s\S]*?)<\/p>$/i);
if (!/class="[^"]*\bsite-definition\b/.test(m[1])) fail(`definition paragraph lacks class site-definition: ${m[1]}`);
const about = html.match(/<section[^>]*data-home-about-block="true"[^>]*>[\s\S]*?<\/section>/i);
if (!about || !about[0].includes(defs[0])) fail('definition paragraph is not inside the About section (data-home-about-block)');
const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const words = text.split(' ').length;
if (words < 40 || words > 60) fail(`definition is ${words} words, need 40-60`);
if (!text.startsWith(`${brand} is `)) fail(`definition must open "${brand} is ...": "${text.slice(0, 60)}"`);

const nodes = [];
for (const b of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
  const v = JSON.parse(b[1]);
  nodes.push(...(Array.isArray(v) ? v : [v]));
}
const page = nodes.find((n) => n && n['@type'] === 'WebPage');
if (!page) fail('no WebPage node');
const sp = page.speakable;
if (!sp || sp['@type'] !== 'SpeakableSpecification') fail('WebPage has no SpeakableSpecification');
const sels = Array.isArray(sp.cssSelector) ? sp.cssSelector : [sp.cssSelector];
function resolves(sel) {
  let mm;
  if ((mm = sel.match(/^\.([\w-]+)$/))) return new RegExp(`class="[^"]*\\b${mm[1]}\\b`).test(html);
  if ((mm = sel.match(/^\[([\w-]+)="([^"]*)"\]$/))) return html.includes(`${mm[1]}="${mm[2]}"`);
  if ((mm = sel.match(/^\[([\w-]+)\]$/))) return new RegExp(`\\s${mm[1]}[\\s=>]`).test(html);
  return false;
}
for (const s of sels) if (!resolves(s)) fail(`speakable selector ${s} does not resolve on the homepage`);
const registered = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'contracts', 'site_hygiene_registry.json'), 'utf8')).speakable_selectors;
if (JSON.stringify(sels) !== JSON.stringify(registered)) fail(`speakable selectors ${JSON.stringify(sels)} differ from the registry's ${JSON.stringify(registered)}`);
if (!sels.includes('.site-definition')) fail('speakable does not cover the definition paragraph');
if (!sels.includes('[data-home-questions="true"]')) fail('speakable does not cover the questions section');
console.log(`HOMEPAGE DEFINITION CONTRACT PASS (${brand}, ${words} words, ${sels.length} speakable selectors)`);
