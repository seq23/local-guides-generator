#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: every public host has a brand set, the active pack ships
 * /favicon.ico, /apple-touch-icon.png, /icon-192.png, /icon-512.png and a valid
 * /site.webmanifest, and every rendered page links the icon, touch icon and
 * manifest. Guards the favicon 404 measured on all domains on 10 Oct 2026.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, DIST, publicHosts, activeHost, pages, head } = require('./lib_site_dist');

function fail(msg) { console.error(`SITE ICONS FAIL: ${msg}`); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site_brand_assets.json'), 'utf8'));
for (const host of publicHosts()) {
  if (!cfg.hosts[host]) fail(`no brand set for ${host} in data/site_brand_assets.json`);
  for (const f of cfg.files) if (!fs.existsSync(path.join(ROOT, 'brand', host, f))) fail(`brand/${host}/${f} missing`);
}
const host = activeHost();
if (!cfg.hosts[host]) { console.log(`SITE ICONS: NAMED SKIP - ${host} is not a public host`); process.exit(0); }
for (const f of ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest']) {
  const p = path.join(DIST, f);
  if (!fs.existsSync(p) || fs.statSync(p).size === 0) fail(`${f} missing from output root`);
}
const ico = fs.readFileSync(path.join(DIST, 'favicon.ico'));
if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) fail('favicon.ico is not an ICO file');
const man = JSON.parse(fs.readFileSync(path.join(DIST, 'site.webmanifest'), 'utf8'));
if (man.name !== cfg.hosts[host].name) fail(`site.webmanifest name "${man.name}" is not ${cfg.hosts[host].name}`);
for (const i of man.icons || []) if (!fs.existsSync(path.join(DIST, i.src.replace(/^\//, '')))) fail(`manifest icon ${i.src} missing`);
if (!(man.icons || []).length) fail('site.webmanifest lists no icons');

const all = pages(fail);
const bad = all.filter(({ html }) => {
  const h = head(html);
  return !/<link rel="icon" href="\/favicon\.ico"/i.test(h) || !/<link rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"/i.test(h) || !/<link rel="manifest" href="\/site\.webmanifest"/i.test(h);
});
if (bad.length) fail(`${bad.length}/${all.length} pages lack icon/manifest links, e.g. ${bad.slice(0, 3).map((b) => b.file).join(', ')}`);
console.log(`SITE ICONS CONTRACT PASS (${host}, ${all.length} pages)`);
