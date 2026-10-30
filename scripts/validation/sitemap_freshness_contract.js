#!/usr/bin/env node
'use strict';
/**
 * Search Readiness a6: rebuilding unchanged feeds must not invent freshness.
 *
 * The per-page ledger already holds content dates, but buildIndex() stamped
 * the build day on every child feed. The same child bytes therefore acquired
 * a different lastmod every day. An index lastmod describes the FEED's change
 * time, not the newest page's date (https://www.sitemaps.org/protocol.html).
 * We have no feed-change ledger, so the index omits that optional field.
 *
 * Execute the real emitter against fixed pages on two simulated build days.
 * Compare every feed, including the index: a source-only regex cannot prove
 * that unchanged inputs keep their published bytes. Both dates are outside
 * the fixture pages' fresh window, keeping intentional age-based priority
 * changes out of this invariant. No network, secrets, or canonical writes.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const EMITTER = path.resolve(__dirname, '..', 'sitemap_emit.js');
const HOSTS = ['uscisexam.com', 'theaccidentguides.com', 'neuroevalguides.com', 'hormonesivhair.com'];
const DAYS = ['2026-10-30T12:00:00Z', '2026-11-01T12:00:00Z'];
const CONTENT_DATE = '2026-03-18';

function check(host) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-freshness-'));
  try {
    const dist = path.join(root, 'dist');
    const pages = [['', 'home'], ['hartford-ct', 'city-home'], ['states/CT', 'state-surface'], ['guides/example', 'guide-detail']];
    for (const [route, family] of pages) {
      const dir = path.join(dist, route);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'),
        `<meta name="citation_modified_date" content="${CONTENT_DATE}T00:00:00Z">` +
        `<meta name="page-family" content="${family}"><main>Unchanged ${family} content</main>`);
    }
    const clock = path.join(root, 'clock.cjs');
    fs.writeFileSync(clock,
      'const NativeDate = Date; global.Date = class extends NativeDate {\n' +
      '  constructor(...args) { super(...(args.length ? args : [process.env.SITEMAP_TEST_CLOCK])); }\n' +
      '  static now() { return new NativeDate(process.env.SITEMAP_TEST_CLOCK).getTime(); }\n' +
      '};\n');
    const snapshots = DAYS.map((day) => {
      execFileSync(process.execPath, ['--require', clock, EMITTER], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, SITE_URL: `https://${host}`, SITEMAP_TEST_CLOCK: day },
        stdio: 'pipe',
      });
      return Object.fromEntries(fs.readdirSync(dist).filter((name) => /^sitemap.*\.xml$/.test(name))
        .sort().map((name) => [name, fs.readFileSync(path.join(dist, name), 'utf8')]));
    });
    assert.ok(Object.keys(snapshots[0]).length > 1, `${host}: fixture emitted no child feeds`);
    for (const [name, xml] of Object.entries(snapshots[0])) {
      assert.equal(snapshots[1][name], xml, `${host}/${name}: a clock-only rebuild changed an unchanged feed`);
      if (name === 'sitemap.xml') {
        assert.doesNotMatch(xml, /<lastmod>/, `${host}: index dates require a persisted feed-change history`);
      } else {
        assert.match(xml, new RegExp(`<lastmod>${CONTENT_DATE}</lastmod>`), `${host}/${name}: lost content dates`);
      }
    }
    assert.deepEqual(Object.keys(snapshots[1]), Object.keys(snapshots[0]), `${host}: clock-only rebuild changed the feed set`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const problems = [];
for (const host of HOSTS) {
  try { check(host); } catch (error) { problems.push(error.message); }
}
if (problems.length) {
  console.error('SITEMAP FRESHNESS CONTRACT FAIL\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`SITEMAP FRESHNESS CONTRACT PASS (${HOSTS.length} hosts: unchanged feeds and content dates survive a clock-only rebuild)`);
