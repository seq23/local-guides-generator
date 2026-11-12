import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the production renderer without starting the whole build pipeline.
const source = fs.readFileSync(new URL('../../scripts/build_city_sites.js', import.meta.url), 'utf8');
const renderer = source.slice(source.indexOf('function renderStateLookupCta('), source.indexOf('\nfunction stripPiOnlyDisallowedBlocks'));
assert.ok(renderer.length > 0, 'production lookup renderer missing');
const render = vm.runInNewContext(`(${renderer})`, {
  loadLicensingLookup: (key) => JSON.parse(fs.readFileSync(new URL(`../../data/licensing_lookup/${key}.json`, import.meta.url))),
  normalizeUrl: (value) => String(value || ''),
  escapeHtml: (value) => String(value),
});
for (const [vertical, host] of [['neuro', 'asppb.net'], ['trt', 'www.fsmb.org']]) {
  test(`${vertical}: state CTA uses the profession's board, not the shared dental registry`, () => {
    for (const [state, stateName, wrong] of [
      ['NC', 'North Carolina', 'https://www.members-base.com/NCBDESearch/search'],
      ['AZ', 'Arizona', 'https://dentalboard.az.gov/'],
    ]) {
      const html = render({ state, stateName, licenseLookupUrl: wrong }, vertical);
      assert.ok(html.includes(`href="https://${host}/`), html);
      assert.ok(!html.includes(wrong), html);
    }
  });
}
test('a missing state mapping never falls back to a different profession', () => {
  const html = render({state: 'ZZ', stateName: 'Unknown', licenseLookupUrl: 'https://dentalboard.az.gov/'}, 'neuro');
  assert.ok(!html.includes('href='));
});
