#!/usr/bin/env node
/**
 * The neuro city pages are generated. This is the contract that says the
 * checked-in files are still what the generator produces, and that every one of
 * them carries the vertical's anchor phrases.
 *
 * Why this exists: scripts/research/build_neuro_city_research.js rewrites all 56
 * data/city_content/neuro/*.json from a template on every run, unconditionally.
 * That is the same producer shape that deleted enriched sections in
 * local-guides-citation-velocity on 2026-09-02 - a generator that regenerates
 * pages it did not enrich - and neuro was the only vertical of the two with such
 * a producer and no parity contract behind it. trt has had one since
 * trt_city_research_contract.js; this is its neuro counterpart.
 *
 * multi_vertical_citation_repair_contract.js pins two phrases on this layer, but
 * it inspects atlanta-ga.json only. A generator edit that dropped a phrase from
 * the other 55 would pass. That is how the trt equivalent was caught by accident
 * of which city a contract happened to name.
 *
 * Three checks:
 *
 *   1. Inventory. Every city the generator writes has a file, and every file on
 *      disk is a city the generator writes. A city with no state mapping is
 *      skipped by the generator, so it is skipped here too.
 *
 *   2. Anchor coverage. Every file carries each phrase in ANCHORS - the same
 *      requirement multi_vertical_citation_repair makes of atlanta, applied to
 *      the whole vertical.
 *
 *   3. Generator parity. Re-run the generator in memory and require the bytes to
 *      match what is committed. That catches a generator changed without
 *      regenerating, a file regenerated from stale inputs, and a file hand-
 *      enriched into a shape the generator will silently revert on its next run.
 *
 * The generator is imported, not executed - it only writes under
 * `require.main === module` - so this validator never touches the working tree.
 *
 * Hard-fails when it examines zero city files, so it cannot pass on an empty
 * directory or an emptied city list.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'data', 'city_content', 'neuro');
const GENERATOR = path.join(ROOT, 'scripts', 'research', 'build_neuro_city_research.js');

// Kept in sync with multi_vertical_citation_repair_contract.js's neuro city row.
const ANCHORS = ['neuro provider authority framework', 'symptom-to-evaluation-path decision tree'];

const failures = [];

if (!fs.existsSync(GENERATOR)) {
  console.error('NEURO city research contract FAIL');
  console.error(`- missing generator: ${path.relative(ROOT, GENERATOR)}`);
  process.exit(1);
}

const { serialize, writableCities } = require(GENERATOR);

if (typeof serialize !== 'function' || typeof writableCities !== 'function') {
  console.error('NEURO city research contract FAIL');
  console.error('- scripts/research/build_neuro_city_research.js no longer exports { serialize, writableCities }');
  process.exit(1);
}

const cities = writableCities();

if (!Array.isArray(cities) || cities.length === 0) {
  console.error('NEURO city research contract FAIL');
  console.error('- the generator reports zero writable cities. Nothing was examined, which is a defect, not a pass.');
  process.exit(1);
}

const onDisk = fs.existsSync(OUT_DIR)
  ? fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json')).sort()
  : [];

if (onDisk.length === 0) {
  console.error('NEURO city research contract FAIL');
  console.error('- data/city_content/neuro/ holds no city files. Nothing was examined, which is a defect, not a pass.');
  process.exit(1);
}

const expected = cities.map((c) => `${c.slug}.json`).sort();

for (const file of expected) {
  if (!onDisk.includes(file)) failures.push(`data/city_content/neuro/${file} is in the generator's city list but not on disk`);
}
for (const file of onDisk) {
  if (!expected.includes(file)) failures.push(`data/city_content/neuro/${file} is on disk but not in the generator's city list`);
}

let examined = 0;
for (const city of cities) {
  const rel = `data/city_content/neuro/${city.slug}.json`;
  const abs = path.join(OUT_DIR, `${city.slug}.json`);
  if (!fs.existsSync(abs)) continue; // already reported above
  examined += 1;
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
    failures.push(`${rel} differs from generator output. Run: node scripts/research/build_neuro_city_research.js`);
  }
}

if (examined === 0) {
  console.error('NEURO city research contract FAIL');
  console.error('- zero city files were compared against the generator. Nothing was examined, which is a defect, not a pass.');
  process.exit(1);
}

if (failures.length) {
  // A generator regression breaks all 56 at once, so print enough to identify
  // the pattern and then say how many more there are.
  const shown = process.argv.includes('--all') ? failures.length : 15;
  console.error('NEURO city research contract FAIL');
  failures.slice(0, shown).forEach((f) => console.error('- ' + f));
  if (failures.length > shown) {
    console.error(`- ...and ${failures.length - shown} more. Full list: node scripts/validation/neuro_city_research_contract.js --all`);
  }
  process.exit(1);
}

console.log(
  `NEURO city research contract PASS: ${examined} city files match the generator and carry all ${ANCHORS.length} anchor phrases.`
);
