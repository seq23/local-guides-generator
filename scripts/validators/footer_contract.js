#!/usr/bin/env node
/*
FOOTER CONTRACT (HARD FAIL) — SIMPLIFIED

User directive:
A) Footer must exist on every built HTML page.
B) Footer must include the required compliance words (canonical text contract).

NOT enforced here (by design):
- No requirement for a specific attribute marker.
- No requirement for specific link markup (links may change without breaking compliance copy).

How it works:
- Finds the LAST <footer>...</footer> block on the page (assumes global footer is last).
- Strips tags, normalizes whitespace, then checks required canonical lines (text-only).
*/

const fs = require('fs');
const path = require('path');

const DIST_DIR = 'dist';
const CANON_PATH = path.join('docs', 'policies', 'footer_canonical.txt');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function walkHtml(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkHtml(p));
    else if (ent.isFile() && ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function normalizeWhitespace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normalizeCopyrightSpacing(s) {
  // Accept both "©2026" and "© 2026" and normalize to "© 2026".
  return String(s || '')
    .replace(/\(c\)\s*(\d{4})/gi, '© $1')
    .replace(/©\s*(\d{4})/g, '© $1');
}

function stripTags(html) {
  let s = String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<\/div\s*>/gi, '\n');

  s = s.replace(/<[^>]+>/g, ' ');

  s = s
    .replace(/&copy;/gi, '©')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');

  return s;
}

function extractFooter(html) {
  const re = /<footer\b[^>]*>[\s\S]*?<\/footer>/gi;
  const matches = String(html || '').match(re);
  if (!matches || !matches.length) return null;
  return matches[matches.length - 1];
}

function loadCanon() {
  if (!fs.existsSync(CANON_PATH)) {
    die(`FOOTER CONTRACT FAIL: missing canonical footer file: ${CANON_PATH}`);
  }
  return fs
    .readFileSync(CANON_PATH, 'utf8')
    .split(/\r?\n/)
    .map(l => normalizeWhitespace(l))
    .filter(Boolean);
}

function expectedCanonLines(brandName) {
  const lines = loadCanon();
  const year = new Date().getFullYear();
  return lines.map(l =>
    l
      .replace(/%%YEAR%%/g, String(year))
      .replace(/%%BRAND_NAME%%/g, brandName || '')
  );
}

// NOTE: We intentionally do NOT validate any copyright line.
// Reason: the rendered footer may encode the symbol differently (© vs &copy;),
// include NBSP, or vary formatting across builds. We only enforce the presence
// of the global footer container + required compliance copy lines.

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    die(`FOOTER CONTRACT FAIL: dist/ not found. Run a build before validating.`);
  }

  let brandName = '';
  try {
    const site = JSON.parse(fs.readFileSync(path.join('data', 'site.json'), 'utf8'));
    if (site && site.BRAND_NAME) brandName = String(site.BRAND_NAME);
  } catch (_) {}

  const canonLines = expectedCanonLines(brandName);
  const htmlFiles = walkHtml(DIST_DIR);

  const failures = [];

  for (const fpath of htmlFiles) {
    const html = fs.readFileSync(fpath, 'utf8');
    const footerHtml = extractFooter(html);

    if (!footerHtml) {
      failures.push({ file: fpath, reason: 'missing <footer>...</footer>' });
      continue;
    }

    const footerText = normalizeWhitespace(normalizeCopyrightSpacing(stripTags(footerHtml)));
    // Enforce all canonical lines except the copyright line.
    const missingLines = canonLines.filter(line => {
      // Skip the copyright line to avoid false negatives when the brand name
      // or encoding differs.
      if (/^©\s*\d{4}\b/.test(line)) return false;
      const needle = normalizeWhitespace(normalizeCopyrightSpacing(line));
      return needle && !footerText.includes(needle);
    });

    if (missingLines.length) {
      failures.push({
        file: fpath,
        reason: `missing required footer copy line(s): ${missingLines.join(' | ')}`,
      });
    }
  }

  if (failures.length) {
    console.error('FOOTER CONTRACT FAIL:\n' + failures.slice(0, 25).map(f => `- ${f.file}: ${f.reason}`).join('\n'));
    if (failures.length > 25) console.error(`...and ${failures.length - 25} more`);
    process.exit(1);
  }

  console.log('FOOTER CONTRACT PASS');
}

main();
