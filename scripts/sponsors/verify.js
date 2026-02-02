/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const { run: runBuyoutsSchema } = require('../validation/buyouts_schema');

// This verifier checks the sponsor JSON ...
// 1) schema validity
// 2) buyout overlap invariants (hierarchy-aware)

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function fileExists(fp) {
  try { fs.accessSync(fp, fs.constants.R_OK); return true; } catch (_){ return false; }
}

function dateWindowsOverlap(a, b) {
  const aStart = a.starts_on ? new Date(a.starts_on) : null;
  const aEnd = a.ends_on ? new Date(a.ends_on) : null;
  const bStart = b.starts_on ? new Date(b.starts_on) : null;
  const bEnd = b.ends_on ? new Date(b.ends_on) : null;

  // Treat missing ends_on as far-future
  const aEndEff = aEnd || new Date('9999-12-31');
  const bEndEff = bEnd || new Date('9999-12-31');
  const aStartEff = aStart || new Date('1970-01-01');
  const bStartEff = bStart || new Date('1970-01-01');

  return aStartEff <= bEndEff && bStartEff <= aEndEff;
}

function targetsLikelyOverlap(a, b) {
  // Scope-aware quick overlap test.
  // vertical overlaps everything but is allowed.
  if (a.scope === 'vertical' || b.scope === 'vertical') return true;

  // If scopes differ, only overlap if they can hit the same page type.
  // city vs state vs guide don't overlap by definition.
  if (a.scope !== b.scope) return false;

  const aTargets = Array.isArray(a.targets) ? a.targets : [];
  const bTargets = Array.isArray(b.targets) ? b.targets : [];

  if (aTargets.includes('ALL') || bTargets.includes('ALL')) return true;
  const bSet = new Set(bTargets.map(String));
  return aTargets.map(String).some(t => bSet.has(t));
}

function enforceNoEqualPriorityOverlaps(buyouts) {
  const live = (buyouts || []).filter(b => b && b.live);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];

      // Vertical overlaps are allowed (deferred vertical).
      if (a.scope === 'vertical' || b.scope === 'vertical') continue;

      if (!dateWindowsOverlap(a, b)) continue;
      if (!targetsLikelyOverlap(a, b)) continue;

      const ap = Number.isFinite(a.priority) ? a.priority : 0;
      const bp = Number.isFinite(b.priority) ? b.priority : 0;

      if (ap === bp) {
        throw new Error(
          `BUYOUT OVERLAP ERROR: Two LIVE non-vertical buyouts overlap with the same priority (${ap}).\n` +
          `A: scope=${a.scope} targets=${JSON.stringify(a.targets)} starts_on=${a.starts_on} ends_on=${a.ends_on}\n` +
          `B: scope=${b.scope} targets=${JSON.stringify(b.targets)} starts_on=${b.starts_on} ends_on=${b.ends_on}`
        );
      }
    }
  }
}

function main() {
  const repoRoot = process.cwd();

  // 1) validate sponsor JSON schema (existing behavior)
  const globalPath = path.join(repoRoot, 'data', 'sponsors', 'global.json');
  if (!fileExists(globalPath)) {
    console.log('✅ SPONSOR VERIFY SKIP (no data/sponsors/global.json)');
  } else {
    const global = readJson(globalPath);
    if (global && typeof global !== 'object') throw new Error('data/sponsors/global.json must be an object');
    console.log('✅ SPONSOR VERIFY PASS (global.json present)');
  }

  // 2) buyouts schema + overlap invariants
  const buyoutsPath = path.join(repoRoot, 'data', 'buyouts.json');
  if (!fileExists(buyoutsPath)) {
    console.log('✅ BUYOUT VERIFY SKIP (no data/buyouts.json)');
    return;
  }

  // Schema validator lives under scripts/validation and is called by validate:all too,
  // but sponsors/verify is a good place to fail early for operators.
  runBuyoutsSchema({ repoRoot });

  const buyouts = readJson(buyoutsPath);
  if (!Array.isArray(buyouts)) throw new Error('data/buyouts.json must be an array');

  enforceNoEqualPriorityOverlaps(buyouts);
  console.log('✅ BUYOUT VERIFY PASS (no illegal equal-priority overlaps)');
}

if (require.main === module) {
  main();
}

module.exports = { main };
