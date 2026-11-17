// A guide's "Source:" line links the source it names, in place, and nothing else
// is touched: no words added, no source invented, no link nested in a link
// (scripts/lib/guide_source_links.js; Search Readiness q1 d3, 17 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { linkNamedSources } = require('../../scripts/lib/guide_source_links.js');

const text = (h) => h.replace(/<[^>]+>/g, '');
const hrefs = (h) => [...h.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);

test('a named court fee schedule and statute are linked, words unchanged', () => {
  const p = '<p><strong>Source:</strong> Administrative Office of the U.S. Courts, <em>District Court Miscellaneous Fee Schedule</em>, effective 1 December 2023, and 28 U.S.C. &sect; 1914(a).</p>';
  const out = linkNamedSources(p);
  assert.deepEqual(hrefs(out), ['https://www.uscourts.gov/court-programs/fees/district-court-miscellaneous-fee-schedule', 'https://www.law.cornell.edu/uscode/text/28/1914']);
  assert.equal(text(out), text(p));
});

test('the CMS dataset name and a bare uscis.gov address are linked; trailing period stays text', () => {
  const cms = linkNamedSources('<p><strong>Source:</strong> Centers for Medicare &amp; Medicaid Services, <em>Medicare Physician &amp; Other Practitioners — by Geography and Service</em>, 2024.</p>');
  assert.match(hrefs(cms)[0], /by-geography-and-service$/);
  const uscis = linkNamedSources('<p>Source: USCIS, Form I-693 page, uscis.gov/i-693.</p>');
  assert.deepEqual(hrefs(uscis), ['https://www.uscis.gov/i-693']);
  assert.match(uscis, /uscis\.gov\/i-693<\/a>\.<\/p>$/);
});

test('negative: prose that is not a Source line, and an existing link, are left alone', () => {
  const prose = '<p>The District Court Miscellaneous Fee Schedule is on uscis.gov/i-693 too.</p>';
  assert.equal(linkNamedSources(prose), prose);
  const linked = '<p>Source: <a href="https://www.uscis.gov/i-693">uscis.gov/i-693</a></p>';
  assert.equal(linkNamedSources(linked), linked);
  const unknown = '<p>Source: a clinic price list we read in 2026.</p>';
  assert.equal(linkNamedSources(unknown), unknown, 'an unregistered source is never given an invented link');
});
