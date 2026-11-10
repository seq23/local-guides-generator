// Search Readiness q1, 10 Nov 2026: dentistry /states/<ST>/ hubs and PI
// /states/<ST>/next-steps/ pages were one page with the state name swapped in
// (0.74 and 0.87 alike). Each state now carries its own sourced facts.
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { forState, piState, words } = require('../../scripts/lib/city_local_facts.js');

const shingles = (t) => { const w = String(t).replace(/<[^>]+>/g, ' ').toLowerCase().match(/[a-z0-9][\w'’-]*/g) || []; const s = new Set(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' ')); return s; };
const jaccard = (a, b) => { const A = shingles(a), B = shingles(b); let k = 0; for (const x of A) if (B.has(x)) k++; return k / (A.size + B.size - k); };
const linksOut = (html) => /<a href="https:\/\/(?!dentistryguides|theaccidentguides)[^"]+"/.test(html);

for (const [label, get, pairs] of [
  ['dentistry state hub (HRSA)', (ab, name) => forState('dentistry', ab, name, []), [['AZ', 'Arizona'], ['OH', 'Ohio'], ['KS', 'Kansas']]],
  ['PI state next steps (FARS)', (ab, name) => piState(ab, name), [['SD', 'South Dakota'], ['HI', 'Hawaii'], ['MT', 'Montana']]],
]) {
  test(label + ': a 40-60 word defining answer, a linked source, and its own words', () => {
    const out = pairs.map(([ab, name]) => get(ab, name));
    for (const r of out) {
      assert.ok(r, 'no facts for a state the research file covers');
      const w = words(r.answer);
      assert.ok(w >= 40 && w <= 60 && /\b(is|are)\b/.test(r.answer), `answer is ${w} words: ${r.answer}`);
      assert.ok(linksOut(r.html), 'the figures link no source');
    }
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const s = jaccard(out[i].answer + out[i].html, out[j].answer + out[j].html);
      assert.ok(s < 0.5, `${pairs[i][0]}/${pairs[j][0]} facts are ${s.toFixed(2)} alike`);
    }
  });
}

test('a state with no research row gets no invented facts', () => {
  assert.equal(forState('dentistry', 'ZZ', 'Nowhere', []), null);
  assert.equal(piState('ZZ', 'Nowhere'), null);
});
