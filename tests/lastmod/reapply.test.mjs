import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { contentHash, HASH_BASIS } = require('../../scripts/lib/lastmod_ledger');
const { stampDates } = require('../../scripts/lastmod_apply');
const buildIso = '2026-10-29T02:00:00.000Z';
const page = (body) => '<html><head><meta name="citation_modified_date" content="' + buildIso + '" /></head><body><main>' + body + '</main></body></html>';
const home = page('<h1>Local guides</h1><p>Reviewed · Updated <time data-page-modified="true" datetime="' + buildIso + '">' + buildIso + '</time> · Official sources</p>');
const city = page('<h1>Hartford</h1><p>Compare local options.</p>');

test('generated freshness labels hash exactly like their unstamped source', () => {
  for (const raw of [home, city]) {
    const stamped = stampDates(raw, '2026-10-20T00:00:00.000Z', '2026-03-18T00:00:00.000Z');
    assert.equal(contentHash(stamped), contentHash(raw));
    assert.equal(contentHash(stampDates(stamped, '2026-11-03T00:00:00.000Z', '2026-03-18T00:00:00.000Z')), contentHash(raw));
    // Ordinary editorial dates and changed prose still count as content.
    assert.notEqual(contentHash(stamped.replace('</h1>', ' revised</h1>')), contentHash(raw));
    assert.notEqual(contentHash(stamped.replace('</main>', '<p>Reviewed October 30, 2026</p></main>')), contentHash(raw));
  }
});

for (const domain of ['uscisexam.com', 'theaccidentguides.com', 'neuroevalguides.com', 'hormonesivhair.com']) {
  test(`${domain}: repeated freshness and sitemap emission hold dates; a real edit advances only its page`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-lastmod-reapply-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const dir of ['scripts/lib', 'data/cadence', 'dist/hartford-ct']) fs.mkdirSync(path.join(root, dir), { recursive: true });
    for (const rel of ['scripts/lib/lastmod_ledger.js', 'scripts/lastmod_apply.js', 'scripts/sitemap_emit.js']) {
      fs.copyFileSync(new URL(`../../${rel}`, import.meta.url), path.join(root, rel));
    }
    fs.writeFileSync(path.join(root, 'data/site.json'), JSON.stringify({ siteUrl: `https://${domain}` }));
    fs.writeFileSync(path.join(root, 'dist/index.html'), home);
    fs.writeFileSync(path.join(root, 'dist/hartford-ct/index.html'), city);
    const entries = Object.fromEntries([['/', home], ['/hartford-ct/', city]].map(([route, html]) => [
      `https://${domain}${route}`, { hash: contentHash(html), basis: HASH_BASIS, lastmod: '2026-10-20', first_seen: '2026-03-18' },
    ]));
    const ledgerFile = path.join(root, 'data/cadence/lastmod_ledger.json');
    fs.writeFileSync(ledgerFile, JSON.stringify({ seeded_on: '2026-03-18', entries }));
    const run = (day) => {
      const env = { ...process.env, SITE_URL: `https://${domain}`, BUILD_DATE: day };
      const log = execFileSync(process.execPath, ['scripts/lastmod_apply.js'], { cwd: root, env, encoding: 'utf8' });
      execFileSync(process.execPath, ['scripts/sitemap_emit.js'], { cwd: root, env, stdio: 'pipe' });
      return log;
    };
    run('2026-10-29');
    const ledger = fs.readFileSync(ledgerFile, 'utf8');
    const rendered = fs.readFileSync(path.join(root, 'dist/hartford-ct/index.html'), 'utf8');
    const sitemap = fs.readFileSync(path.join(root, 'dist/sitemap-cities.xml'), 'utf8');
    assert.match(run('2026-11-03'), /0 advanced/);
    assert.equal(fs.readFileSync(ledgerFile, 'utf8'), ledger);
    assert.equal(fs.readFileSync(path.join(root, 'dist/hartford-ct/index.html'), 'utf8'), rendered);
    assert.equal(fs.readFileSync(path.join(root, 'dist/sitemap-cities.xml'), 'utf8'), sitemap);
    assert.match(sitemap, /<lastmod>2026-10-20<\/lastmod>/);

    fs.writeFileSync(path.join(root, 'dist/hartford-ct/index.html'), rendered.replace('Compare local options.', 'Compare newly researched local options.'));
    assert.match(run('2026-11-04'), /1 advanced/);
    const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).entries;
    assert.equal(after[`https://${domain}/`].lastmod, '2026-10-20');
    assert.equal(after[`https://${domain}/hartford-ct/`].lastmod, '2026-11-04');
    assert.equal(after[`https://${domain}/hartford-ct/`].first_seen, '2026-03-18');
    assert.match(run('2026-11-05'), /0 advanced/);
  });
}
