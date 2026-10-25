#!/usr/bin/env node
'use strict';
/**
 * The committed lastmod ledger must match the pages the build produces.
 *
 * The defect this exists to stop. data/cadence/lastmod_ledger.json records, per
 * URL, the hash of the content and the date that content last changed;
 * scripts/lastmod_apply.js advances a page's date only when its hash no longer
 * matches. Nothing, however, ever committed the updated ledger back. The deploy
 * (.github/workflows/deploy-distribution.yml) checks out main, builds, and
 * throws the working tree away, so:
 *
 *   - main's committed ledger drifted behind main's content. On 25 Oct 2026 a
 *     fresh checkout built 608 of 1,210 pages whose stored hash no longer
 *     matched.
 *   - every deploy therefore advanced those same 608 pages to the deploy date,
 *     then discarded the result, so the next deploy did it again with the new
 *     date.
 *
 * The live symptom was Search Readiness item a6 on all six canonical hosts -
 * for example 61 of 64 URLs in uscisexam.com/sitemap-core.xml carrying that
 * day's date. The dates were not a renderer bug: two consecutive builds of the
 * same tree produce identical hashes (0 of 1,210 changed). The cause was that
 * the ledger on main was never current, and nothing could tell.
 *
 * What this checks. The build has already run by the time validators run, and
 * scripts/lastmod_apply.js has written the ledger it resolved. So the question
 * "did this build find content the committed ledger did not know about?" is
 * answered by comparing the ledger in the working tree against the committed
 * one. Any URL whose hash the build changed is a page whose freshness date the
 * deploy would advance to the deploy date - and the fix is to commit the ledger
 * the build just produced, which this failure tells the author to do.
 *
 * Why it is safe to hard-fail. It compares against `git show HEAD:<path>`, so
 * it is inert outside a git checkout (it passes, loudly) and it never needs
 * network or credentials. A PR that legitimately changes page content stays red
 * only until its author commits the regenerated ledger, which is the one step
 * that was missing all along.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LEDGER = path.join('data', 'cadence', 'lastmod_ledger.json');
const MAX_LISTED = 15;

function fail(msg) {
  console.error(`❌ LASTMOD LEDGER CURRENCY FAIL — ${msg}`);
  process.exit(1);
}

function committedLedger() {
  try {
    const raw = execFileSync('git', ['show', `HEAD:${LEDGER}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(LEDGER)) fail(`${LEDGER} is missing; scripts/lastmod_apply.js never ran.`);

  const working = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const committed = committedLedger();
  if (!committed) {
    // No git object to compare against (a tarball, a shallow export). Say so
    // rather than passing silently: Rule 0 - no stage may exit 0 having done
    // nothing without a human seeing why.
    console.log('ℹ️ LASTMOD LEDGER CURRENCY SKIP — no committed ledger to compare (not a git checkout).');
    return;
  }

  const wEntries = (working && working.entries) || {};
  const cEntries = (committed && committed.entries) || {};
  if (!Object.keys(wEntries).length) fail('the ledger in the working tree has no entries.');

  // A build must not erase the record that the dates were reseeded from git:
  // scripts/lib/lastmod_ledger.js merged() once rewrote the header on every
  // build, so the committed ledger claimed no historical dates existed.
  if (committed.reseeded_from_git_on && working.reseeded_from_git_on !== committed.reseeded_from_git_on) {
    fail('the build dropped reseeded_from_git_on from the ledger header; scripts/lib/lastmod_ledger.js merged() must carry it through.');
  }
  if (committed.reseeded_from_git_on && !/reseeded from real git history/i.test(String(working.note || ''))) {
    fail('the build rewrote the ledger note to say no historical dates were reconstructed, but they were (reseeded_from_git_on is set).');
  }

  const stale = [];
  const added = [];
  for (const [url, entry] of Object.entries(wEntries)) {
    const prev = cEntries[url];
    if (!prev) { added.push(url); continue; }
    if (prev.hash !== entry.hash) stale.push({ url, from: prev.lastmod, to: entry.lastmod });
  }

  if (stale.length || added.length) {
    const lines = [];
    if (stale.length) {
      lines.push(`${stale.length} page(s) whose content changed but whose committed ledger entry still holds the old hash:`);
      for (const s of stale.slice(0, MAX_LISTED)) lines.push(`    ${s.url}  ${s.from} -> ${s.to}`);
      if (stale.length > MAX_LISTED) lines.push(`    ... and ${stale.length - MAX_LISTED} more`);
    }
    if (added.length) {
      lines.push(`${added.length} new page(s) not in the committed ledger:`);
      for (const u of added.slice(0, MAX_LISTED)) lines.push(`    ${u}`);
      if (added.length > MAX_LISTED) lines.push(`    ... and ${added.length - MAX_LISTED} more`);
    }
    lines.push('');
    lines.push('Every deploy rebuilds from the committed ledger and discards the result, so each of');
    lines.push('these pages would be stamped with the deploy date on every deploy - the uniform');
    lines.push('<lastmod> that Search Readiness item a6 reports. Commit the regenerated ledger:');
    lines.push(`    git add ${LEDGER}`);
    fail(lines.join('\n'));
  }

  console.log(
    `✅ LASTMOD LEDGER CURRENCY PASS — ${Object.keys(wEntries).length} URLs; the committed ledger matches what this build produced.`
  );
}

main();
