#!/usr/bin/env node
'use strict';
/**
 * A page's <lastmod> may never move FORWARD while its content hash stands still.
 *
 * The invariant. data/cadence/lastmod_ledger.json records, per URL, the hash of
 * the page's content and the date that content last changed.
 * scripts/lib/lastmod_ledger.js resolve() advances a date only when the hash no
 * longer matches, so "same hash, later date" is a claim that cannot be derived
 * from the content: it says the page changed on a day when, by its own hash, it
 * did not.
 *
 * The defect this exists to stop. On 31 Oct 2026 commit 8456454 ("Record page
 * freshness for the 2026-10-31 search observations", written by the
 * Rotating Refresh workflow) changed nothing but the ledger - no content file at
 * all - and moved 179 entries' lastmod to that day. 176 of them kept the exact
 * hash, basis and first_seen they already had. The live symptom was Search
 * Readiness item a6 on the side-business hosts: every URL in
 * uscisexam.com/sitemap-cities.xml and sitemap-states.xml, and 32 of 35 in
 * sitemap-fresh.xml, carrying that day's date. A sitemap whose dates advance
 * without content behind them is the exact signal a6 exists to catch, and it
 * teaches a crawler that this sitemap's dates mean nothing.
 *
 * resolve() could not have produced those rows, so nothing in the pipeline was
 * lying - something wrote the ledger around it. This contract does not try to
 * name that writer. It pins the property that makes the whole ledger worth
 * reading, so any writer that breaks it is caught in the commit that does so,
 * whatever its route.
 *
 * Why FORWARD only. A date corrected BACKWARD can never overstate freshness: it
 * withdraws a claim rather than making one. The repair that accompanies this
 * contract moves 174 inflated dates back to the values they held before the bad
 * commit, and scripts/reseed_lastmod_from_git.js legitimately rewrites dates
 * from real git history without touching hashes. Blocking only forward movement
 * keeps both of those honest operations legal while making the inflation
 * impossible to land again.
 *
 * What it compares. The ledger committed at HEAD against the ledger at HEAD's
 * first parent - the commit under test. In the Rotating Refresh workflow that is
 * exactly the freshness commit it creates, because the workflow runs a plain
 * `node scripts/build_all_packs.js` (which runs this tier) after committing the
 * ledger and before pushing. On a pull request it is the branch's own commit.
 *
 * Why it is safe to hard-fail. It reads only `git show`, so it needs no network
 * and no credentials, and it passes loudly - never fails - when the history or
 * either ledger is unreadable (a shallow clone, a root commit, a tree with no
 * ledger yet). It can only fail on a real, specific, listed regression.
 */
const path = require('path');
const { execFileSync } = require('child_process');

const LEDGER = path.join('data', 'cadence', 'lastmod_ledger.json');
const MAX_LISTED = 15;

function ledgerAt(ref) {
  try {
    const raw = execFileSync('git', ['show', `${ref}:${LEDGER}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(raw);
    return parsed && parsed.entries && typeof parsed.entries === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function main() {
  // First parent, so a merge commit is compared against the branch it landed on
  // rather than against the side it merged in.
  let parent = '';
  try {
    parent = execFileSync('git', ['rev-parse', '--verify', 'HEAD^1'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    parent = '';
  }
  if (!parent) {
    console.log('✅ LASTMOD DATE INVARIANT PASS — no first parent to compare against (root commit or shallow clone); nothing to check.');
    return;
  }

  const head = ledgerAt('HEAD');
  const base = ledgerAt(parent);
  if (!head || !base) {
    console.log(`✅ LASTMOD DATE INVARIANT PASS — the ledger is not readable at both HEAD and ${parent.slice(0, 8)}; nothing to compare.`);
    return;
  }

  const headEntries = head.entries;
  const baseEntries = base.entries;
  const advanced = [];
  let compared = 0;

  for (const [url, now] of Object.entries(headEntries)) {
    const was = baseEntries[url];
    if (!was) continue; // A new URL has no previous date to contradict.
    compared += 1;
    // A different hash or a different basis is a real content change or a
    // re-keying; resolve() owns both and this contract says nothing about them.
    if (now.hash !== was.hash) continue;
    if ((now.basis || '') !== (was.basis || '')) continue;
    if (!now.lastmod || !was.lastmod) continue;
    if (now.lastmod > was.lastmod) {
      advanced.push(`${url}  ${was.lastmod} -> ${now.lastmod}  (hash unchanged: ${String(now.hash).slice(0, 12)}…)`);
    }
  }

  if (advanced.length) {
    console.error(
      `❌ LASTMOD DATE INVARIANT FAIL — ${advanced.length} ledger entr${advanced.length === 1 ? 'y' : 'ies'} ` +
      'moved lastmod forward while the content hash stood still:'
    );
    advanced.slice(0, MAX_LISTED).forEach((row) => console.error(`    ${row}`));
    if (advanced.length > MAX_LISTED) console.error(`    ... and ${advanced.length - MAX_LISTED} more`);
    console.error('');
    console.error('A later date on identical content is a freshness claim with nothing behind it, and it is');
    console.error('what makes a sitemap\'s <lastmod> worthless to a crawler (Search Readiness item a6). Let');
    console.error('scripts/lastmod_apply.js set these dates from the content hash instead of writing them');
    console.error('directly: build the packs and commit the ledger it produces.');
    console.error('    npm run lastmod:refresh   # every pack, so no site is left half-written');
    console.error(`    git add ${LEDGER}`);
    process.exit(1);
  }

  console.log(
    `✅ LASTMOD DATE INVARIANT PASS — ${compared} entr${compared === 1 ? 'y' : 'ies'} compared against ` +
    `${parent.slice(0, 8)}; no lastmod advanced on unchanged content.`
  );
}

main();
