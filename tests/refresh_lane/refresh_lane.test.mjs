// The refresh lane (scripts/automation/refresh_lane.mjs): what counts as a real
// change, which pages are due, and that refresh questions render. Risk rule
// R-ADV-12: the lane changes words, never dates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { duePages, unwrapDeadLinks, deadLinks, openQuestions, entryProblems, outboundLinks, stalled, ORDER } from '../../scripts/automation/refresh_lane.mjs';

const require = createRequire(import.meta.url);
const blocks = require('../../scripts/search_intelligence/render_blocks.js');

const page = {
  route: '/guides/how-to-choose/',
  title: 'How to Choose a Dentist',
  main_html: '<h2>What Should I Look For When Choosing a Dentist</h2><p>Check the licence on the state dental board site and ask for a written estimate. Medicare covers little routine care. See <a href="https://gone.example/x">the board list</a> and <a href="https://ok.example/">the ADA</a>.</p>',
  search_strengthening: { faq: [{ q: 'How do I choose a dentist?', a: 'x' }] },
};

test('dentistry and the accident guides come first, oldest first, at the pace', () => {
  assert.deepEqual(ORDER.slice(0, 2), ['dentistry', 'pi']);
  const pages = [
    { key: 'trt', url: 'https://t/a', lastmod: '2026-01-01' },
    { key: 'pi', url: 'https://p/a', lastmod: '2026-05-01' },
    { key: 'dentistry', url: 'https://d/b', lastmod: '2026-06-01' },
    { key: 'dentistry', url: 'https://d/a', lastmod: '2026-03-01' },
    { key: 'dentistry', url: 'https://d/new', lastmod: '2026-11-01' },
  ];
  const { due, take } = duePages(pages, { pages: {} }, '2026-11-10');
  assert.deepEqual(due.map((p) => p.url), ['https://d/a', 'https://d/b', 'https://p/a', 'https://t/a']);
  assert.equal(take, 1);
  assert.equal(duePages(pages, { pages: {} }, '2026-11-10').next_due, '2026-12-01', 'the page changed 1 Nov comes due 30 days later');
  const again = duePages(pages, { pages: { 'https://d/a': { checked_at: '2026-11-01' } } }, '2026-11-10');
  assert.ok(!again.due.some((p) => p.url === 'https://d/a'), 'a page checked within 30 days is not due');
});

test('a dead link is unwrapped to its words; a live one stays', async () => {
  const fake = async (url) => ({ status: url.includes('gone') ? 404 : url.includes('blocked') ? 403 : 200 });
  const links = [...outboundLinks(page.main_html), 'https://blocked.example/'];
  const dead = await deadLinks(links, fake);
  assert.deepEqual(dead, ['https://gone.example/x'], 'a 403 is unknown, never dead');
  const out = unwrapDeadLinks(page.main_html, dead);
  assert.ok(out.includes('the board list') && !out.includes('gone.example'));
  assert.ok(out.includes('href="https://ok.example/"'));
  assert.equal(unwrapDeadLinks(page.main_html, []), page.main_html, 'no dead links, no change');
});

test('only real searches the page does not answer yet become questions', () => {
  const rows = [
    { route: page.route, query: 'how do i choose a dentist', impressions: 50 },
    { route: page.route, query: 'dentist licence check online', impressions: 9 },
    { route: '/other/', query: 'dentist licence lookup texas', impressions: 99 },
    { route: page.route, query: 'dentist', impressions: 99 },
  ];
  assert.deepEqual(openQuestions(page, rows).map((r) => r.query), ['dentist licence check online']);
  assert.deepEqual(openQuestions({ ...page, refresh_tried: ['dentist licence check online'] }, rows), []);
});

test('a drafted answer may use only what the page already says', () => {
  const good = { q: 'How do I do a dentist licence check online?', a: 'Look the dentist up on the state dental board site, which lists whether the licence is active, and ask the office for a written estimate before any major work so you can compare offices on the same terms and avoid surprises once treatment has started and plans change.' };
  assert.deepEqual(entryProblems(good, page, 'dentist licence check online'), []);
  assert.ok(entryProblems({ ...good, a: good.a + ' It costs 120 dollars.' }, page, 'dentist licence check online').some((p) => p.includes('120')));
  assert.ok(entryProblems({ ...good, a: good.a.replace('Look', 'Look, as Delta advises,') }, page, 'dentist licence check online').some((p) => p.includes('Delta')));
  assert.ok(entryProblems({ ...good, a: good.a + ' The best way.' }, page, 'dentist licence check online').length);
  assert.ok(entryProblems({ ...good, q: 'What is a crown?' }, page, 'dentist licence check online').length);
  assert.ok(entryProblems({ ...good, a: 'Too short.' }, page, 'dentist licence check online').length);
});

test('refresh questions render on the page and in its one FAQPage', () => {
  const p = { ...page, refresh_faq: [{ q: 'How do I do a dentist licence check online?', a: 'Use the board site.' }] };
  const html = blocks.applyStrengthening(p.main_html, p);
  assert.ok(html.includes('data-refresh-faq="true"') && html.includes('dentist licence check online'));
  assert.equal((html.match(/data-search-faq="true"/g) || []).length, 1, 'joins the existing search FAQ');
  const bare = blocks.applyStrengthening(page.main_html, { ...p, search_strengthening: undefined });
  assert.ok(bare.includes('More questions readers ask'));
  assert.equal(blocks.applyStrengthening(page.main_html, page).includes('data-refresh-faq'), false);
  const head = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>';
  const ld = JSON.parse(blocks.mergeFaqIntoJsonLd(head, p).match(/>([\s\S]*)</)[1]);
  assert.deepEqual(ld.mainEntity.map((q) => q.name), ['How do I choose a dentist?', 'How do I do a dentist licence check online?']);
});

test('three runs with due pages and nothing refreshed is a stall', () => {
  assert.equal(stalled([{ due: 3, refreshed: 0 }, { due: 3, refreshed: 0 }, { due: 3, refreshed: 0 }]), true);
  assert.equal(stalled([{ due: 3, refreshed: 0 }, { due: 3, refreshed: 1 }, { due: 3, refreshed: 0 }]), false);
  assert.equal(stalled([{ due: 0, refreshed: 0 }, { due: 0, refreshed: 0 }, { due: 0, refreshed: 0 }]), false);
});
