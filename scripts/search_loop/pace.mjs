// The canonical side's own pace for missing guides. search-loop v1.3.0 (3 Nov 2026)
// retired the engine's pace.mjs (its own new-page cap replaced it), but the canonical
// loop never used the engine to publish daily pages: its quota is min(this pace,
// cadence policy). This is the v1.2.6 engine module, kept here unchanged so the
// canonical behaviour does not move with the engine's release.
// isoWeek is the engine's (util.mjs), passed in by canonical_loop.mjs loadEngine.
// Pace: start 10/day, +5 a week while most new pages are indexed within 14 days, cap
// 30, halve automatically when indexing falls. Evaluated once per ISO week.
import fs from 'node:fs';
import path from 'node:path';

export const PACE_DEFAULTS = { start_per_day: 10, step_per_week: 5, cap: 30, min_per_day: 2, indexed_share_to_grow: 0.5, index_window_days: 14 };

// pace.json sits in the site's ledger dir, as it did when the engine's ledger owned it
// (v1.3.0's ledger no longer lists it).
export function writePace(L, data) {
  fs.mkdirSync(L.dir, { recursive: true });
  fs.writeFileSync(path.join(L.dir, 'pace.json'), JSON.stringify(data, null, 2) + '\n');
}

function readPace(L) {
  try { return JSON.parse(fs.readFileSync(path.join(L.dir, 'pace.json'), 'utf8')); } catch { return null; }
}

export function currentPace(cfg, L) {
  const p = readPace(L);
  if (p && Number.isFinite(p.per_day)) return p;
  return { schema: 'search-loop-pace-v1', per_day: cfg.pace.start_per_day, last_eval_week: null, history: [] };
}

// sample: { measured: n pages old enough, indexed: n of them indexed, source }
export function nextPace(cfg, pace, sample, now = new Date(), isoWeek) {
  const week = isoWeek(now);
  if (pace.last_eval_week === week) return { pace, changed: false, reason: 'already evaluated this week' };
  const { cap, step_per_week: step, min_per_day: min, indexed_share_to_grow: grow } = cfg.pace;
  const from = pace.per_day;
  let to = from;
  let reason;
  if (!sample || sample.measured === 0 || sample.indexed == null) {
    reason = `held at ${from}/day: indexing not read (${sample?.reason || 'no pages old enough to measure'})`;
  } else {
    const share = sample.indexed / sample.measured;
    const pct = Math.round(share * 100);
    if (share > grow) { to = Math.min(cap, from + step); reason = `${sample.indexed}/${sample.measured} (${pct}%) of pages ${cfg.pace.index_window_days}+ days old are indexed (${sample.source}) — ${to === from ? `held at the cap ${cap}` : `up ${step}`}`; }
    else { to = Math.max(min, Math.floor(from / 2)); reason = `only ${sample.indexed}/${sample.measured} (${pct}%) of pages ${cfg.pace.index_window_days}+ days old are indexed (${sample.source}) — halved`; }
  }
  const out = { ...pace, per_day: to, last_eval_week: week, history: [...(pace.history || []), { at: now.toISOString(), week, from, to, reason }].slice(-104) };
  return { pace: out, changed: to !== from, reason };
}
