#!/usr/bin/env node
/**
 * The trt city pages are generated. This is the contract that says the checked-in
 * files are still what the generator produces, and that every one of them carries
 * the vertical's anchor phrases.
 *
 * Why this exists: scripts/research/build_trt_city_research.js rewrote all 56
 * trt city files from scratch. In doing so it silently dropped two phrases that
 * multi_vertical_citation_repair_contract.js pins - "TRT clinic authority
 * framework" and "Baseline labs" - and the build went red. That contract only
 * inspects atlanta-ga.json, so it caught the regression in one city out of 56 by
 * accident of which city it happened to name. The other 55 could have lost the
 * same phrases and nothing would have said so.
 *
 * Two checks, both cheap:
 *
 *   1. Anchor coverage. Every data/city_content/trt/*.json must carry each phrase
 *      in ANCHORS. This is the same requirement multi_vertical_citation_repair
 *      makes of atlanta, applied to the whole vertical, so a generator edit that
 *      drops a phrase fails on all 56 files rather than on whichever one a
 *      contract happened to name.
 *
 *   2. Generator parity. Re-run the generator in memory and require the bytes to
 *      match what is committed. That catches the other half of the failure mode:
 *      a generator changed without regenerating, a file regenerated from stale
 *      inputs, or a city file hand-edited into a shape the generator will silently
 *      revert the next time anyone runs it.
 *
 * The generator is imported, not executed - it only writes when run as main - so
 * this validator never touches the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'data', 'city_content', 'trt');
const GENERATOR = path.join(ROOT, 'scripts', 'research', 'build_trt_city_research.js');

// The phrases multi_vertical_citation_repair_contract.js pins on the trt city
// layer. Kept in sync with that contract's trt row on purpose: if a phrase is
// worth requiring of atlanta it is worth requiring of the other 55.
const ANCHORS = ['TRT clinic authority framework', 'Baseline labs'];

const failures = [];

if (!fs.existsSync(GENERATOR)) {
  console.error('TRT city research contract FAIL');
  console.error(`- missing generator: ${path.relative(ROOT, GENERATOR)}`);
  process.exit(1);
}

const { CITIES, serialize } = require(GENERATOR);

if (!Array.isArray(CITIES) || typeof serialize !== 'function') {
  console.error('TRT city research contract FAIL');
  console.error('- scripts/research/build_trt_city_research.js no longer exports { CITIES, serialize }');
  process.exit(1);
}

const onDisk = fs.existsSync(OUT_DIR)
  ? fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json')).sort()
  : [];
const expected = CITIES.map((c) => `${c.slug}.json`).sort();

for (const file of expected) {
  if (!onDisk.includes(file)) failures.push(`data/city_content/trt/${file} is in the city list but not on disk`);
}
for (const file of onDisk) {
  if (!expected.includes(file)) failures.push(`data/city_content/trt/${file} is on disk but not in data/page_sets/examples/cities_trt_v1.json`);
}

for (const city of CITIES) {
  const rel = `data/city_content/trt/${city.slug}.json`;
  const abs = path.join(OUT_DIR, `${city.slug}.json`);
  if (!fs.existsSync(abs)) continue; // already reported above
  const actual = fs.readFileSync(abs, 'utf8');

  for (const anchor of ANCHORS) {
    if (!actual.includes(anchor)) failures.push(`${rel} missing anchor phrase: ${anchor}`);
  }

  let rebuilt;
  try {
    rebuilt = serialize(city);
  } catch (error) {
    failures.push(`${rel} generator threw while rebuilding: ${error.message}`);
    continue;
  }
  if (rebuilt !== actual) {
    failures.push(
      `${rel} differs from generator output. Run: node scripts/research/build_trt_city_research.js`
    );
  }
}

if (failures.length) {
  // A generator regression breaks all 56 at once, so print enough to identify
  // the pattern and then say how many more there are rather than filling the
  // CI log with the same three lines fifty-six times.
  const shown = process.argv.includes('--all') ? failures.length : 15;
  console.error('TRT city research contract FAIL');
  failures.slice(0, shown).forEach((f) => console.error('- ' + f));
  if (failures.length > shown) {
    console.error(`- ...and ${failures.length - shown} more. Full list: node scripts/validation/trt_city_research_contract.js --all`);
  }
  process.exit(1);
}
console.log(
  `TRT city research contract PASS: ${CITIES.length} city files match the generator and carry all ${ANCHORS.length} anchor phrases.`
);
