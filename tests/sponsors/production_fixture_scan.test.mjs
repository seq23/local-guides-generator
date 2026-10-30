import test from 'node:test';
import assert from 'node:assert/strict';
import fixtureGuard from '../../scripts/validation/production_sponsor_fixture_contract.js';

test('rejects test sponsors anywhere in a production page', () => {
  assert.ok(fixtureGuard.findFixtureText('<main><h2>ACME Law</h2></main>').length);
  assert.ok(fixtureGuard.findFixtureText('<p>Call +1-555-555-5555</p>').length);
  assert.ok(fixtureGuard.findFixtureText('<section data-training-sponsor="true"></section>').length);
});

test('does not reject ordinary non-sponsored content', () => {
  assert.deepEqual(fixtureGuard.findFixtureText('<main><h1>Find a civil surgeon in Brooklyn</h1></main>'), []);
});
