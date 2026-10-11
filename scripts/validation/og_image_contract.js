#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: /og.png is a 1200x630 PNG in the output root, and every rendered
 * page declares og:image on its own host with og:image:width/height matching
 * the file, plus twitter:image and a summary_large_image card.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, DIST, activeHost, pages, head, metaContent } = require('./lib_site_dist');

function fail(msg) { console.error(`OG IMAGE FAIL: ${msg}`); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site_brand_assets.json'), 'utf8'));
const host = activeHost();
if (!cfg.hosts[host]) { console.log(`OG IMAGE: NAMED SKIP - ${host} is not a public host`); process.exit(0); }
const og = cfg.og;
const file = path.join(DIST, og.path.replace(/^\//, ''));
if (!fs.existsSync(file)) fail(`${og.path} missing from output root`);
const png = fs.readFileSync(file);
if (png.toString('ascii', 1, 4) !== 'PNG') fail(`${og.path} is not a PNG`);
const w = png.readUInt32BE(16); const h = png.readUInt32BE(20);
if (w !== og.width || h !== og.height) fail(`${og.path} is ${w}x${h}, expected ${og.width}x${og.height}`);

const want = `https://${host}${og.path}`;
const all = pages(fail);
const bad = [];
for (const { file: f, html } of all) {
  const hd = head(html);
  const img = metaContent(hd, 'property', 'og:image');
  const problems = [];
  if (img.length !== 1 || img[0] !== want) problems.push(`og:image=${JSON.stringify(img)}`);
  if (metaContent(hd, 'property', 'og:image:width')[0] !== String(og.width)) problems.push('og:image:width');
  if (metaContent(hd, 'property', 'og:image:height')[0] !== String(og.height)) problems.push('og:image:height');
  if (metaContent(hd, 'name', 'twitter:image')[0] !== want) problems.push('twitter:image');
  const card = metaContent(hd, 'name', 'twitter:card');
  if (card.length && card[0] !== 'summary_large_image') problems.push(`twitter:card=${card[0]}`);
  if (problems.length) bad.push(`${f} (${problems.join(', ')})`);
}
if (bad.length) fail(`${bad.length}/${all.length} pages: ${bad.slice(0, 3).join('; ')}`);
console.log(`OG IMAGE CONTRACT PASS (${host}, ${all.length} pages, ${w}x${h})`);
