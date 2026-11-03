/* eslint-disable no-console */
/**
 * A provider card says what is true of THAT provider; the advice that applies to
 * every card in a directory section is printed once, on the section.
 *
 * WHY: defaultProviderAttributes() used to append the vertical's generic "how to
 * compare" advice to every card, so a city page listing nine clinics printed the
 * same sentence nine times - "Ask what is included before treatment starts and what
 * is billed separately" ten times on hormonesivhair.com/portland-me/ and
 * /baltimore-md/, "Use this when you are comparing ..." seven times on
 * neuroevalguides.com/wilmington-de/, /philadelphia-pa/ and /newark-nj/. The
 * Search Readiness quality sample reads any 8-word phrase repeated more than three
 * times in one body as template filler (fix-queue 3 Nov 2026) and it was right.
 *
 * So this checks, the last being the defect itself:
 *   1. every card carries its meta line (as before);
 *   2. a card's attribute list, when present, is not empty - a provider with
 *      nothing specific on file renders no list rather than an empty one;
 *   3. every full directory section carries exactly one guidance list;
 *   4. no identical attribute line sits on more than SLOT_MAX cards of a section.
 */
const fs = require('fs');
const path = require('path');

const SLOT_MAX = 3;

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name.toLowerCase().endsWith('.html')) acc.push(full);
  }
}

const visible = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ');

function directorySections(html) {
  return html.match(/<section\b[^>]*data-provider-directory="true"[^>]*>[\s\S]*?<\/section>/gi) || [];
}

function run() {
  const distDir = path.join(process.cwd(), 'dist');
  const files = [];
  walk(distDir, files);
  const bad = [];
  let cardsSeen = 0;
  files.forEach((fp) => {
    const html = fs.readFileSync(fp, 'utf8');
    const count = (html.match(/data-provider-card="true"/g) || []).length;
    if (!count) return;
    const rel = path.relative(distDir, fp);
    cardsSeen += count;

    const metaCount = (html.match(/data-provider-card-meta="true"/g) || []).length;
    if (metaCount < count) bad.push(rel + ': provider card missing meta line');

    for (const ul of html.match(/<ul\b[^>]*data-provider-card-attributes="true"[^>]*>[\s\S]*?<\/ul>/gi) || []) {
      if (!/<li\b/i.test(ul)) bad.push(rel + ': provider card renders an empty attributes list');
    }

    const sections = directorySections(html);

    // The homepage preview (data-home-provider-preview) is a compact teaser with
    // no advice on its cards and nothing to hoist, so it is not asked for one.
    sections.forEach((sec, i) => {
      if (/data-home-provider-preview="true"/.test(sec)) return;
      const g = (sec.match(/data-provider-directory-guidance="true"/g) || []).length;
      if (g !== 1) bad.push(`${rel}: provider directory section ${i + 1} carries ${g} guidance list(s), expected exactly 1`);
    });

    // The defect itself: one generic sentence copied onto every card. Repetition of
    // a card's category, market and verify label is what a directory listing IS,
    // and is deliberately not counted here.
    sections.forEach((sec, i) => {
      const tally = new Map();
      for (const ul of sec.match(/<ul\b[^>]*data-provider-card-attributes="true"[^>]*>[\s\S]*?<\/ul>/gi) || []) {
        for (const li of ul.match(/<li\b[^>]*>([\s\S]*?)<\/li>/gi) || []) {
          const t = visible(li).replace(/\s+/g, ' ').trim().toLowerCase();
          if (t) tally.set(t, (tally.get(t) || 0) + 1);
        }
      }
      for (const [text, n] of tally) {
        if (n > SLOT_MAX) {
          bad.push(`${rel}: provider directory section ${i + 1} puts "${text}" on ${n} cards - advice that applies to every card belongs on the section, once`);
        }
      }
    });
  });
  if (cardsSeen === 0) {
    // Not every pack renders a provider directory - senior_living lists facilities
    // and binders instead - so zero cards is only a lie if the pack put a directory
    // section on a page without any cards in it. That is checked; "no directory at
    // all" is a named skip, the same shape shared_sources_hash_contract.js uses.
    const emptyDirs = [];
    for (const fp of files) {
      const html = fs.readFileSync(fp, 'utf8');
      if (directorySections(html).length) emptyDirs.push(path.relative(distDir, fp));
    }
    if (emptyDirs.length) {
      throw new Error('PROVIDER CARD CONTRACT FAIL\n' + emptyDirs.map((f) => ` - ${f}: renders a provider directory section with no provider card in it`).join('\n'));
    }
    console.log(`\u2139\uFE0F PROVIDER CARD CONTRACT SKIP - the pack in dist/ renders no provider directory across ${files.length} page(s)`);
    return;
  }
  if (bad.length) throw new Error('PROVIDER CARD CONTRACT FAIL\n' + bad.map((b) => ' - ' + b).join('\n'));
  console.log(`✅ provider card contract pass (${cardsSeen} card(s))`);
}

if (require.main === module) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { run };
