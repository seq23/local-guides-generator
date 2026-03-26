/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fileExists(fp) {
  try {
    fs.accessSync(fp, fs.constants.R_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function walkHtml(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(fp, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(fp);
  }
}

function fail(label, detail) {
  throw new Error(`PUBLIC OUTBOUND LINK POLICY FAIL: ${detail} :: ${label}`);
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || process.cwd();
  const distDir = path.join(repoRoot, 'dist');
  if (!fileExists(distDir)) throw new Error('PUBLIC OUTBOUND LINK POLICY FAIL: dist/ not found. Run build first.');

  const htmlFiles = [];
  walkHtml(distDir, htmlFiles);
  if (!htmlFiles.length) throw new Error('PUBLIC OUTBOUND LINK POLICY FAIL: no HTML files found in dist/.');

  for (const fp of htmlFiles) {
    const rel = path.relative(repoRoot, fp);
    const html = fs.readFileSync(fp, 'utf8');
    const exampleSections = html.match(/<section[^>]*data-example-providers="true"[^>]*>[\s\S]*?<\/section>/gi) || [];
    for (const section of exampleSections) {
      if (/<ul[^>]*class="neutral-list"[^>]*>[\s\S]*?<a\s+href=/i.test(section)) {
        fail(rel, 'example providers list contains outbound link');
      }
    }
    const piDirectoryTables = html.match(/<table[^>]*class="[^"]*pi-directory-table[^"]*"[^>]*>[\s\S]*?<\/table>/gi) || [];
    for (const table of piDirectoryTables) {
      if (/<a\s+href=/i.test(table)) fail(rel, 'PI directory table contains outbound link');
      if (/(Official website|Official site)/i.test(table)) fail(rel, 'PI directory table still exposes official website label');
    }

    const stateDirectoryCards = html.match(/<div class="card">[\s\S]*?Listed in this state directory[\s\S]*?<\/div>/gi) || [];
    for (const card of stateDirectoryCards) {
      if (/<a\s+href=/i.test(card)) fail(rel, 'state directory card contains outbound link');
    }

    const isPiDirectorySurface = /pi-directory-table|Listed in this state directory/i.test(html);
    if (isPiDirectorySurface) {
      const scripts = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi) || [];
      for (const block of scripts) {
        if (/"@type"\s*:\s*"CollectionPage"/i.test(block) && /"itemListElement"/i.test(block) && /"item"\s*:\s*\{[\s\S]{0,200}?"@type"\s*:\s*"Organization"[\s\S]{0,200}?"url"\s*:/i.test(block)) {
          fail(rel, 'PI CollectionPage ItemList Organization still exposes url in JSON-LD');
        }
      }
    }
  }

  console.log('✅ PUBLIC OUTBOUND LINK POLICY PASS');
}

module.exports = { run };
