#!/usr/bin/env node
'use strict';
/**
 * Hard-fail (AEO): the homepage's first element after the H1 is a 40-60 word
 * definition paragraph that opens "<Brand> is", and the WebPage node carries a
 * SpeakableSpecification whose every cssSelector resolves on the page and which
 * covers both the definition and the short-answer FAQ.
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

const m = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*(<p[^>]*>)([\s\S]*?)<\/p>/i);
if (!m) fail('no paragraph directly after the H1');
if (!/data-site-definition="true"/.test(m[1]) || !/class="[^"]*\bsite-definition\b/.test(m[1])) fail(`element after the H1 is not the definition paragraph: ${m[1]}`);
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
if (!sels.includes('.site-definition')) fail('speakable does not cover the definition paragraph');
if (!sels.some((s) => /home-answer/.test(s))) fail('speakable does not cover the short-answer FAQ');
console.log(`HOMEPAGE DEFINITION CONTRACT PASS (${brand}, ${words} words, ${sels.length} speakable selectors)`);
