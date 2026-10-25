#!/usr/bin/env node
'use strict';
/**
 * Every indexable page's <title> and meta description are the right length and
 * the title is unique.
 *
 * What it pins (Search Readiness Checklist, owner, 25 Oct 2026):
 *   b1  title 30-65 characters, and no two indexable pages share a title
 *   b2  exactly one meta description, 120-160 characters
 *   d4  a page whose JSON-LD claims a date shows that date in its text
 *
 * Why it is needed. These were drifting silently and in both directions.
 * Measured on 25 Oct 2026 before the fix: 27 titles ran to 66-73 characters
 * (Google truncates the line, so the overflow is spent on nothing) and 19 meta
 * descriptions came in at 111-118. The causes were ordinary and would recur
 * with the next page: a brand suffix appended to an already-long title, a
 * hand-written guide title, and one fixed template sentence used for place
 * phrases ranging from "in Cordova, TN" to "near Baptist Memorial
 * Hospital-Collierville". Nothing measured any of it, so nothing said so.
 *
 * d4 is here too because it has the same shape: the renderer put
 * datePublished/dateModified in JSON-LD and citation_* meta on every page and
 * showed the date to no reader. scripts/lastmod_apply.js now inserts the
 * visible line; this proves it is actually on the page that claims the date.
 *
 * Deliberately skipped: pages carrying robots noindex. An operator console or a
 * thin template-fallback city page is not a search landing page, and
 * scripts/apply_robots_policy.js keeps both out of the index and the sitemap on
 * purpose - holding them to a search-result standard would be measuring the
 * wrong thing.
 */
const fs = require('fs');
const path = require('path');

const TITLE_MIN = 30;
const TITLE_MAX = 65;
const DESC_MIN = 120;
const DESC_MAX = 160;
const MAX_LISTED = 12;

const DIST = path.join(process.cwd(), 'dist');

function unescapeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;amp;/g, '&');
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name.toLowerCase() === 'index.html') acc.push(full);
  }
  return acc;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('❌ SEARCH READINESS HEAD FAIL — dist/ not found. Run a build first.');
    process.exit(1);
  }
  const files = walk(DIST, []).sort();
  if (!files.length) {
    console.error('❌ SEARCH READINESS HEAD FAIL — dist/ holds no pages; refusing to pass on nothing.');
    process.exit(1);
  }

  const titleOwners = new Map();
  const badTitle = [];
  const badDesc = [];
  const badDate = [];
  let checked = 0;

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    // Not a search landing page; see the header.
    if (/<meta[^>]+name=(["'])robots\1[^>]*?content=(["'])((?:(?!\2)[\s\S])*)\2/i.test(html)
        && /noindex/i.test((html.match(/<meta[^>]+name=(["'])robots\1[^>]*?content=(["'])((?:(?!\2)[\s\S])*)\2/i) || [])[3] || '')) continue;
    checked += 1;
    const rel = path.relative(DIST, file).replace(/\\/g, '/').replace(/index\.html$/, '') || '/';

    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = tm ? unescapeHtml(tm[1]).trim() : '';
    if (!title) badTitle.push(`${rel}  has no <title>`);
    else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      badTitle.push(`${rel}  title is ${title.length} chars (want ${TITLE_MIN}-${TITLE_MAX}): ${title}`);
    }
    if (title) {
      if (!titleOwners.has(title)) titleOwners.set(title, []);
      titleOwners.get(title).push(rel);
    }

    // Match the closing quote to the opening one. `content="[^"']*"` looked
    // tidy and truncated every description containing an apostrophe at the
    // apostrophe - "one month's rent" reported as 105 characters when the tag
    // held 135 - which is a validator inventing a defect, the worst kind.
    const descs = [...html.matchAll(/<meta[^>]+name=(["'])description\1[^>]*?content=(["'])((?:(?!\2)[\s\S])*)\2/gi)]
      .map((m) => unescapeHtml(m[3]).trim());
    if (descs.length !== 1) {
      badDesc.push(`${rel}  has ${descs.length} meta descriptions (want exactly 1)`);
    } else if (descs[0].length < DESC_MIN || descs[0].length > DESC_MAX) {
      badDesc.push(`${rel}  description is ${descs[0].length} chars (want ${DESC_MIN}-${DESC_MAX})`);
    }

    // d4: a date claimed in JSON-LD has to be visible to a reader.
    const claimed = (html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/) || [])[1];
    if (claimed) {
      const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || '';
      const text = unescapeHtml(main.replace(/<[^>]+>/g, ' '));
      const human = new Date(`${claimed}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      if (!text.includes(claimed) && !text.includes(human)) {
        badDate.push(`${rel}  claims dateModified ${claimed} and shows no date in its text`);
      }
    }
  }

  const dupes = [...titleOwners.entries()].filter(([, pages]) => pages.length > 1);
  const problems = [];
  const section = (label, rows) => {
    if (!rows.length) return;
    problems.push(`${label} (${rows.length}):`);
    rows.slice(0, MAX_LISTED).forEach((r) => problems.push(`    ${r}`));
    if (rows.length > MAX_LISTED) problems.push(`    ... and ${rows.length - MAX_LISTED} more`);
  };
  section('b1 titles outside the length window', badTitle);
  section('b1 titles used by more than one page', dupes.map(([t, pages]) => `${pages.length} pages share "${t}": ${pages.slice(0, 3).join(', ')}`));
  section('b2 meta descriptions', badDesc);
  section('d4 dates claimed but not shown', badDate);

  if (problems.length) {
    console.error('❌ SEARCH READINESS HEAD FAIL');
    problems.forEach((p) => console.error(` - ${p}`));
    process.exit(1);
  }
  console.log(`✅ SEARCH READINESS HEAD PASS — ${checked} indexable page(s) of ${files.length}: titles ${TITLE_MIN}-${TITLE_MAX} and unique, one meta description ${DESC_MIN}-${DESC_MAX}, every claimed date visible.`);
}

main();
