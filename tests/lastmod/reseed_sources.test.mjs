/**
 * The reseeder resolves a page's date from that page's own content, never from a
 * file the whole pack shares.
 *
 * What this pins. scripts/reseed_lastmod_from_git.js folded two pack-wide files
 * - data/page_sets/examples/<pack>_v1.json and its cities list - plus
 * data/contracts/guide_enhancement_registry.json into the source set of every
 * page that reads them. One commit to any of those moved every city, state and
 * guide page in the pack onto that commit's date, and the Search Readiness audit
 * reported item a6 failing on uscisexam.com, dentistryguides.com,
 * theaccidentguides.com and neuroevalguides.com on 26 Oct 2026 for exactly that
 * reason - the uniform_lastmod the ledger exists to remove, re-created by the
 * tool meant to remove it.
 *
 * Three properties keep it removed, and each one failed before the fix:
 *   1. The pack page set is not a source of any page.
 *   2. A shared manifest is resolved through a per-page slice, not whole-file.
 *   3. A head-only key (meta_title, meta_description) is not content - the same
 *      basis scripts/lib/lastmod_ledger.js hashes <main> for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const reseed = require('../../scripts/reseed_lastmod_from_git.js');
const { sourcesFor, sliceDates, cityRow, stateRows, mainContentOf, GUIDE_REGISTRY } = reseed;

const rels = (srcs) => srcs.map((s) => (typeof s === 'string' ? s : s.rel));
const sliced = (srcs, rel) => srcs.find((s) => typeof s === 'object' && s.rel === rel);

test('the pack page set is not a source of any page', () => {
  for (const [pack, route] of [
    ['uscis_medical', '/'],
    ['uscis_medical', '/guides/document-checklist/'],
    ['dentistry', '/states/oh/'],
    ['dentistry', '/atlanta-ga/'],
    ['dentistry', '/albany-ny/'],
    ['dentistry', '/about/'],
  ]) {
    const paths = rels(sourcesFor(pack, route));
    assert.ok(
      !paths.some((p) => /\/examples\/[a-z_]+_v1\.json$/.test(p) && !p.includes('/cities_')),
      `${pack} ${route} still resolves to the pack page set: ${paths.join(', ')}`
    );
  }
});

test('every route still resolves to something', () => {
  for (const [pack, route] of [
    ['dentistry', '/'],
    ['dentistry', '/about/'],
    ['dentistry', '/atlanta-ga/'],
    ['dentistry', '/albany-ny/'],
    ['dentistry', '/states/oh/'],
    ['pi', '/guides/medical-malpractice/'],
    ['trt', '/guides/peptide-clinic-near-me/'],
  ]) {
    assert.ok(sourcesFor(pack, route).length > 0, `${pack} ${route} resolves to no source`);
  }
});

test('a city page is sliced to its own row, a state hub to its own state', () => {
  const citiesFile = 'data/page_sets/examples/cities_dentistry_v1.json';
  const city = sourcesFor('dentistry', '/albany-ny/');
  const cityEntry = sliced(city, citiesFile);
  assert.ok(cityEntry, 'the cities list is not sliced for a city page');
  const state = sourcesFor('dentistry', '/states/oh/');
  const stateEntry = sliced(state, citiesFile);
  assert.ok(stateEntry, 'the cities list is not sliced for a state hub');

  // The selectors must pick this page's part of the file and nothing else, or
  // one commit moves every page that reads it.
  const rows = [
    { city: 'Albany', state: 'NY', slug: 'albany-ny' },
    { city: 'Columbus', state: 'OH', slug: 'columbus-oh' },
    { city: 'Dayton', state: 'OH', slug: 'dayton-oh' },
  ];
  assert.deepEqual(cityEntry.slice(rows), rows[0]);
  assert.deepEqual(stateEntry.slice(rows).map((r) => r.slug), ['columbus-oh', 'dayton-oh']);
  assert.equal(cityRow('nowhere-zz')(rows), undefined);
  assert.deepEqual(stateRows('zz')(rows), []);
});

test('a slice takes the date its own part last changed, not the file\'s', () => {
  // Newest commit first, as `git log` returns them. Injected, because the merge
  // gate checks out shallow and real history there is one grafted commit.
  const rowsFor = (albany) => [{ slug: 'albany-ny', note: albany }, { slug: 'columbus-oh', note: 'fixed' }];
  const history = [
    { date: '2026-10-25', json: rowsFor('b') },  // another row changed, not Albany's
    { date: '2026-10-20', json: rowsFor('b') },  // Albany's row changed here
    { date: '2026-06-01', json: rowsFor('a') },
    { date: '2026-02-11', json: rowsFor('a') },
  ];
  // Albany's row last changed on the 20th, even though the file changed on the 25th.
  assert.deepEqual(sliceDates('x', cityRow('albany-ny'), history), { last: '2026-10-20', first: '2026-02-11' });
  // Columbus never changed: its date is the oldest commit that carried it.
  assert.deepEqual(sliceDates('x', cityRow('columbus-oh'), history), { last: '2026-02-11', first: '2026-02-11' });
  // A row that appears partway through dates from the commit that added it.
  const added = [{ date: '2026-10-25', json: rowsFor('b').concat([{ slug: 'new-tx' }]) }, { date: '2026-02-11', json: rowsFor('a') }];
  assert.deepEqual(sliceDates('x', cityRow('new-tx'), added), { last: '2026-10-25', first: '2026-10-25' });
  // A row that is never there resolves to null, never to a date.
  assert.equal(sliceDates('x', cityRow('nowhere-zz'), history), null);
  assert.equal(sliceDates('x', cityRow('albany-ny'), []), null);
});

test('a guide is sliced to its own entry in the enhancement registry', () => {
  const g = sourcesFor('dentistry', '/guides/dental-crowns/');
  const entry = sliced(g, GUIDE_REGISTRY);
  assert.ok(entry, 'the guide enhancement registry is not sliced');
  // The selector must pick one route out of the registry, not the whole file.
  const reg = { '/guides/dental-crowns/': { best: 'x' }, '/guides/other/': { best: 'y' } };
  assert.deepEqual(entry.slice(reg), { best: 'x' });
});

test('a head-only key is not content', () => {
  const before = { route: '/next-steps/', meta_title: 'Next Steps: Narrowing a Provider Search', main_html: '<p>same</p>' };
  const after = { route: '/next-steps/', meta_title: 'Next Steps: Narrowing a Search', main_html: '<p>same</p>' };
  assert.deepEqual(mainContentOf(before), mainContentOf(after));
  const changed = { ...after, main_html: '<p>different</p>' };
  assert.notDeepEqual(mainContentOf(after), mainContentOf(changed));
});


test('the reseeder carries an entry\'s hash basis through', () => {
  // Dropping `basis` made scripts/lib/lastmod_ledger.js resolve() treat every
  // entry as mid-rebasing on the next build and hold its date, so a page whose
  // content really had changed kept its old lastmod for one build.
  const src = readFileSync(new URL('../../scripts/reseed_lastmod_from_git.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('next[url] = {'), src.indexOf('if (next[url].lastmod'));
  assert.match(block, /basis: entry\.basis/, 'the reseeder no longer carries entry.basis into the rewritten entry');
});
