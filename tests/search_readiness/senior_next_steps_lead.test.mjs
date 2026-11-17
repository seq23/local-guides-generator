// A senior next-steps page's answer says a different fact from its opening
// definition, and the opening carries the place's own counts - the two blocks
// printing one "closest community" sentence made towns' next-steps pages more
// than half identical (Search Readiness q1, 17 Nov 2026: lakeland vs arlington).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const senior = require('../../scripts/lib/senior_living.js');
const pages = require('../../data/page_sets/examples/cities_senior_living_v1.json');
const list = Array.isArray(pages) ? pages : (pages.cities || pages.pages || []);
const bySlug = (s) => list.find((c) => c.slug === s);

test('answer lead differs from the definition lead on every geolocated page', () => {
  const geo = list.filter((c) => c.lat != null && c.lng != null);
  assert.ok(geo.length >= 20, 'too few senior pages to check: ' + geo.length);
  for (const c of geo) {
    const a = senior.nextStepsAnswerLead(c);
    assert.ok(a, c.slug + ': no answer lead');
    assert.notEqual(a, senior.nextStepsLead(c), c.slug + ': answer repeats the definition');
  }
});

test('the two flagged towns get their own facts in both blocks', () => {
  const lk = bySlug('assisted-living-lakeland-tn'), ar = bySlug('assisted-living-arlington-tn');
  assert.ok(lk && ar, 'flagged pages missing from the page set');
  assert.notEqual(senior.nextStepsAnswerLead(lk), senior.nextStepsAnswerLead(ar));
  assert.notEqual(senior.areaFactsSentence(lk), senior.areaFactsSentence(ar));
  assert.match(senior.nextStepsAnswerLead(lk), /secured unit .* miles away/);
});
