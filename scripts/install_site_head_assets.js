#!/usr/bin/env node
'use strict';
/**
 * Install per-host favicon, web manifest and social card into the output root,
 * and put the matching head tags on every emitted page.
 *
 * Purpose:
 * - /favicon.ico answered 404 on every domain built from this repo and no page
 *   carried og:image, so shares rendered as bare text cards. This closes both
 *   at the build, the same way install_clarity.js installs Clarity.
 *
 * Inputs:
 * - data/site.json (active host, written by prepare_site.js for the pack).
 * - data/site_brand_assets.json (names, colors, og dimensions per host).
 * - brand/<host>/ (favicon.ico, apple-touch-icon.png, icon-192/512.png, og.png;
 *   produced by scripts/brand/generate_brand_assets.py and committed).
 *
 * Outputs:
 * - <out>/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og.png,
 *   site.webmanifest for the active host only.
 * - A head block marked data-site-head-assets on every page: icon links,
 *   manifest, theme-color, og:image (+width/height/type/alt), twitter:image,
 *   and twitter:card upgraded to summary_large_image.
 *
 * Notes:
 * - Fails (exit 1) when the active host has no brand set, so a new domain cannot
 *   ship without icons. The training pack (LKG_ENV=training) is a named skip.
 * - Idempotent: pages already carrying the marker are left alone.
 * - Head-only: lastmod hashes <main>, so this never advances a page's lastmod.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = 'data-site-head-assets';

function die(msg) {
  console.error(`site-head-assets: ${msg}`);
  process.exit(1);
}

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) die(`missing ${rel}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function headBlock(host, b, og) {
  const base = `https://${host}`;
  const alt = escAttr(`${b.name} - ${b.tagline}`);
  return [
    `<link rel="icon" href="/favicon.ico" sizes="any" ${MARKER} />`,
    '<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
    '<link rel="manifest" href="/site.webmanifest" />',
    `<meta name="theme-color" content="${escAttr(b.background)}" />`,
    `<meta property="og:image" content="${base}${og.path}" />`,
    `<meta property="og:image:secure_url" content="${base}${og.path}" />`,
    '<meta property="og:image:type" content="image/png" />',
    `<meta property="og:image:width" content="${og.width}" />`,
    `<meta property="og:image:height" content="${og.height}" />`,
    `<meta property="og:image:alt" content="${alt}" />`,
    `<meta name="twitter:image" content="${base}${og.path}" />`,
    `<meta name="twitter:image:alt" content="${alt}" />`,
  ].join('\n');
}

function manifest(b) {
  return JSON.stringify({
    name: b.name,
    short_name: b.short_name,
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: b.background,
    theme_color: b.background,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }, null, 2) + '\n';
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function install(html, block) {
  if (html.includes(MARKER)) return null;
  const idx = html.search(/<\/head>/i);
  if (idx < 0) return null;
  let head = html.slice(0, idx);
  const rest = html.slice(idx);
  head = head.replace(/<meta name="twitter:card" content="summary"\s*\/?>/i, '<meta name="twitter:card" content="summary_large_image" />');
  // A page that already declares its own og:image keeps it; only icons are added.
  const lines = /property="og:image"/i.test(head)
    ? block.split('\n').filter((l) => !/og:image|twitter:image/.test(l)).join('\n')
    : block;
  return head + lines + '\n' + rest;
}

function main() {
  const site = readJson('data/site.json');
  const cfg = readJson('data/site_brand_assets.json');
  const host = String(site.siteUrl || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
  const b = (cfg.hosts || {})[host];
  if (!b) {
    if (String(process.env.LKG_ENV || '') === 'training') {
      console.log(`site-head-assets: NAMED SKIP - training pack host ${host || '(none)'} has no public brand set`);
      return;
    }
    die(`no brand set for host "${host}" in data/site_brand_assets.json`);
  }
  const srcDir = path.join(ROOT, 'brand', host);
  for (const f of cfg.files) if (!fs.existsSync(path.join(srcDir, f))) die(`missing brand/${host}/${f}; run scripts/brand/generate_brand_assets.py`);
  const outDir = path.resolve(ROOT, process.env.PAGES_OUT_DIR || 'dist');
  if (!fs.existsSync(outDir)) die(`output root ${outDir} not found`);

  for (const f of cfg.files) fs.copyFileSync(path.join(srcDir, f), path.join(outDir, f));
  fs.writeFileSync(path.join(outDir, 'site.webmanifest'), manifest(b));

  const block = headBlock(host, b, cfg.og);
  const pages = walk(outDir, []);
  if (!pages.length) die(`no pages under ${outDir}`);
  let changed = 0;
  for (const p of pages) {
    const next = install(fs.readFileSync(p, 'utf8'), block);
    if (next !== null) { fs.writeFileSync(p, next); changed += 1; }
  }
  console.log(`site-head-assets: ${host} files=${cfg.files.length + 1} pages=${pages.length} tagged=${changed}`);
}

if (require.main === module) main();
module.exports = { install, headBlock, manifest, MARKER };
