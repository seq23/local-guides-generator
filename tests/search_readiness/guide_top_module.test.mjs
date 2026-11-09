// The top module must not reprint a curated sentence the page already shows
// above it (the lede and opening block draw from the same registry entry), and
// it must never render empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { renderGuideTopModule } = require('../../scripts/lib/guide_top_module.js');

const entry = {
  heading: 'Quick decision support',
  best: 'Use this guide when your family is working out how to pay for care.',
  key: 'Most families combine several sources: income, savings and the house.',
  mistake: 'Waiting until the savings are gone before applying for TennCare CHOICES.',
  good: 'A community that explains every fee in writing before move-in.',
  ask: 'Ask which costs rise each year and by how much they rose last year.'
};
const count = (html, s) => html.split(s).length - 1;
const types = ['top_checklist', 'top_comparison_table', 'top_timeline', 'top_cost_table', 'top_decision_tree', 'top_verdict'];

for (const t of types) {
  test(`${t}: a sentence already on the page is not printed again; the rest stay`, () => {
    const above = '<p>' + entry.best + '</p><p>' + entry.key + '</p>';
    const html = renderGuideTopModule('/guides/x/', { top_module_type: t }, entry, above);
    assert.match(html, new RegExp(`data-guide-top-module-type="${t}"`));
    assert.equal(count(html, entry.key), 0, 'key reprinted');
    const fresh = t === 'top_decision_tree' ? [entry.good, entry.mistake] : t === 'top_verdict' ? [entry.ask] : [entry.mistake, entry.ask];
    for (const s of fresh) assert.equal(count(html, s), 1, 'lost a fresh row: ' + s);
  });

  test(`${t}: with every sentence already on the page it still renders one row`, () => {
    const above = Object.values(entry).map((s) => '<p>' + s + '</p>').join('');
    const html = renderGuideTopModule('/guides/x/', { top_module_type: t }, entry, above);
    assert.match(html, /<(li|tr|p)>/);
  });
}

test('with nothing on the page above, every row prints', () => {
  const html = renderGuideTopModule('/guides/x/', { top_module_type: 'top_checklist' }, entry, '');
  for (const s of [entry.best, entry.key, entry.mistake, entry.ask]) assert.equal(count(html, s), 1);
});
