// The fan-out subject is the short form of a guide headline that sits inside a
// search phrase ("red flags for <subject>"). It must be short, and it must be a
// phrase: a cut that ends on a connective is not something anyone searches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { getTopicSubject } = require('../../scripts/helpers/fanout.js');

const guide = (title) => ({ pageKind: 'guide-detail', title, route: '/guides/x/', verticalKey: 'senior_living' });

test('a long enumerated headline is cut at its colon', () => {
  assert.equal(
    getTopicSubject(guide('How Families Pay for Assisted Living: Private Pay, Insurance, VA Benefits, the House, and TennCare CHOICES')),
    'How Families Pay for Assisted Living');
});

test('a short headline is unchanged', () => {
  assert.equal(getTopicSubject(guide('Levels of Care in Tennessee')), 'Levels of Care in Tennessee');
});

test('a capped headline never ends on a connective', () => {
  const s = getTopicSubject(guide('How to Choose a Senior Care Home in Memphis'));
  assert.ok(s.split(/\s+/).length <= 8, s);
  assert.doesNotMatch(s, /\b(in|of|for|the|a|and|to|at|on|with)$/i, s);
  assert.equal(s, 'How to Choose a Senior Care Home');
});

test('no committed fan-out query carries a literal placeholder', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'releases');
  const files = fs.readdirSync(dir).filter((f) => /^fanout_query_clusters\..+\.json$/.test(f));
  assert.ok(files.length >= 6, 'expected one fan-out export per pack, found ' + files.length);
  const queries = [];
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (typeof v.query === 'string') queries.push(v.query); Object.values(v).forEach(walk); } };
  for (const f of files) walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.ok(queries.length > 100, 'too few queries read: ' + queries.length);
  const leaked = queries.filter((q) => /\{[a-zA-Z]+\}/.test(q));
  assert.deepEqual(leaked, []);
});
