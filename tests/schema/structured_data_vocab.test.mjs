// Fixtures for scripts/validation/structured_data_vocab_contract.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { run } = require('../../scripts/validation/structured_data_vocab_contract.js');
const VOCAB = new URL('../../data/contracts/schema_org_vocab.json', import.meta.url);

function fixture(ld) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-vocab-'));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data', 'contracts'), { recursive: true });
  fs.copyFileSync(VOCAB, path.join(root, 'data', 'contracts', 'schema_org_vocab.json'));
  const blocks = (Array.isArray(ld) ? ld : [ld]).map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('');
  fs.writeFileSync(path.join(root, 'dist', 'index.html'), `<html><head>${blocks}</head></html>`);
  return { repoRoot: root };
}

const SITE = {
  '@context': 'https://schema.org', '@type': 'WebSite', name: 'X', url: 'https://e.com/',
  publisher: { '@type': 'Organization', name: 'X', ethicsPolicy: 'https://e.com/editorial-policy/', correctionsPolicy: 'https://e.com/editorial-policy/#corrections', ownershipFundingInfo: 'https://e.com/editorial-policy/#funding' },
  publishingPrinciples: 'https://e.com/methodology/'
};

test('the shared WebSite node as the build now emits it passes', () => {
  const r = run(fixture([SITE, { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'q', acceptedAnswer: { '@type': 'Answer', text: 'a' } }] }]));
  assert.ok(r.nodes >= 5);
});

test('Organization-only properties on WebSite fail (Ahrefs 14 Oct 2026: every page)', () => {
  const bad = { ...SITE, ethicsPolicy: 'https://e.com/editorial-policy/', correctionsPolicy: '/editorial-policy/#corrections', ownershipFundingInfo: 'x' };
  assert.throws(() => run(fixture(bad)), /ethicsPolicy is not a property of WebSite[\s\S]*correctionsPolicy is not a property of WebSite|correctionsPolicy is not a property of WebSite/);
});

test('an inherited property passes (name on WebPage comes from Thing)', () => {
  run(fixture({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'n', speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1'] } }));
});

test('an unknown type, an unknown property and unparseable JSON-LD each fail', () => {
  assert.throws(() => run(fixture({ '@type': 'WebSiteish', name: 'x' })), /unknown schema.org type "WebSiteish"/);
  assert.throws(() => run(fixture({ '@type': 'WebPage', madeUpField: 'x' })), /WebPage\.madeUpField is not a schema.org property/);
  const ctx = fixture({ '@type': 'WebPage', name: 'x' });
  fs.writeFileSync(path.join(ctx.repoRoot, 'dist', 'index.html'), '<script type="application/ld+json">{not json</script>');
  assert.throws(() => run(ctx), /does not parse|zero typed JSON-LD/);
});

test('zero typed nodes is refused, not passed', () => {
  const ctx = fixture({ '@type': 'WebPage', name: 'x' });
  fs.writeFileSync(path.join(ctx.repoRoot, 'dist', 'index.html'), '<p>no structured data</p>');
  assert.throws(() => run(ctx), /zero typed JSON-LD nodes/);
});
