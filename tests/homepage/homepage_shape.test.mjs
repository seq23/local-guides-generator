// Fixtures for scripts/validation/homepage_shape_contract.js: the shape the
// 14 Oct 2026 layout replaced must fail on every rule, the new shape must pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { checkHomepageShape } = require('../../scripts/validation/homepage_shape_contract.js');

const BRAND = 'Example Guides';
const ld = (qs) => '<script type="application/ld+json">' + JSON.stringify([{ '@type': 'Organization', name: BRAND },
  { '@type': 'FAQPage', mainEntity: qs.map((q) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: 'A.' } })) }]) + '</script>';
const page = (head, body) => `<html><head>${head}</head><body><main>${body}</main></body></html>`;
const providers = '<section class="section" data-home-provider-preview="true"><h2>Examples of clinics</h2><article><h3>Clinic One</h3></article></section>';
const QS = ['How much does it cost?', 'What do I bring?', 'How long does it take?', 'Who can do it?', 'What if I miss a dose?', 'Where does the form go?'];
const tiles = '<section data-home-questions="true"><h2>The questions people ask first</h2>' + QS.map((q) => `<h3>${q}</h3><p>A.</p>`).join('') + '</section>';

const NEW = page(ld(QS), '<section class="hero hp-hero"><h1>What does it cost?</h1></section>' + tiles + providers);
const OLD = page(ld([BRAND]),
  '<section class="hero"><h1>' + BRAND + '</h1></section>' +
  '<section class="callout answer-block" data-home-answer="true"><h2>What is ' + BRAND + ', and when should you use it?</h2></section>' +
  providers);

test('the approved shape passes', () => {
  assert.deepEqual(checkHomepageShape(NEW, BRAND), []);
});

test('the old shape fails: H2 about the site and a one-question FAQPage', () => {
  const p = checkHomepageShape(OLD, BRAND);
  assert.ok(p.some((x) => /about the site/.test(x)), p.join('\n'));
  assert.ok(p.some((x) => /carries 1 question/.test(x)), p.join('\n'));
});

test('an "About <Brand>" first H2 fails', () => {
  const html = NEW.replace('The questions people ask first', 'About ' + BRAND);
  assert.ok(checkHomepageShape(html, BRAND).some((x) => /about the site/.test(x)));
});

test('a FAQPage question the page does not show fails', () => {
  const html = NEW.replace(ld(QS), ld(QS.concat(['A question nobody can see?'])));
  assert.ok(checkHomepageShape(html, BRAND).some((x) => /not shown on the page/.test(x)));
});

test('three questions is too few', () => {
  const html = NEW.replace(ld(QS), ld(QS.slice(0, 3)));
  assert.ok(checkHomepageShape(html, BRAND).some((x) => /carries 3 question/.test(x)));
});

test('a homepage without the providers section fails', () => {
  assert.ok(checkHomepageShape(NEW.replace(providers, ''), BRAND).some((x) => /no providers section/.test(x)));
  const empty = NEW.replace('<article><h3>Clinic One</h3></article>', '');
  assert.ok(checkHomepageShape(empty, BRAND).some((x) => /names no provider/.test(x)));
});
