'use strict';
/**
 * The Search Readiness audit's own word measurement, transcribed.
 *
 * Source: boss-os src/shared/boss/searchReadiness/audit.mjs, visibleText() and
 * wordCount(). It is copied rather than imported because that file lives in a
 * different repository and this one takes no dependency on it; it is kept
 * character-exact deliberately, because a floor measured a different way from
 * the auditor is a floor that passes here and fails in the weekly queue.
 */
// Character-exact with audit.mjs line 104.
const decode = (s) => String(s ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function visibleText(html) {
  return decode(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const wordCount = (text) => (String(text).match(/[A-Za-z0-9][\w'’-]*/g) ?? []).length;

const visibleWordCount = (html) => wordCount(visibleText(html));

module.exports = { decode, visibleText, wordCount, visibleWordCount };
