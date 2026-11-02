'use strict';
/**
 * The one rule for length and word-count limits in this repository's validators.
 *
 * Owner ruling, 2 Nov 2026 (personal brain, Settled decisions): "over a word
 * limit never fails; under one fails only below 75% of it". A page a few words
 * or characters off a target is not a defect a reader would notice, so it is
 * reported as a note. Only a real shortfall (under 75% of the floor) blocks.
 *
 * Every length/word floor in scripts/validation reads this file rather than
 * repeating the 75% in its own arithmetic.
 */
const FLOOR_FAIL_SHARE = 0.75;

// The smallest value that does not fail for a given floor.
function hardFloor(floor) {
  return Math.ceil(floor * FLOOR_FAIL_SHARE);
}

// 'fail' below 75% of the floor, 'note' under the floor or over the ceiling,
// 'ok' inside the window. max is optional; over it is never a failure.
function judgeLength(value, min, max) {
  if (value < hardFloor(min)) return 'fail';
  if (value < min) return 'note';
  if (max !== undefined && value > max) return 'note';
  return 'ok';
}

module.exports = { FLOOR_FAIL_SHARE, hardFloor, judgeLength };
