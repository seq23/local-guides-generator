const fs = require('fs');
const path = require('path');

function fail(msg, details = []) {
  const err = new Error(msg + (details.length ? `\n\n${details.join('\n')}` : ''));
  err._validation = 'PACK_SHADOW_GLOBALS';
  throw err;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Canonical rule (user-locked):
 * If a global page exists inside a pack folder, it must be intentionally different.
 * Otherwise, it does not belong there.
 *
 * Implementation (allowlist by filename):
 * 1) Certain "standard" global pages must live ONLY in data/global_pages (base).
 *    If they appear in a pack global pages folder, that is a hard-fail.
 * 2) If any pack global page filename ALSO exists in base and is semantically identical
 *    (title + route + main_html), that is a hard-fail.
 */
function run({ site } = {}) {
  const repoRoot = process.cwd();
  const siteObj = site || (() => {
    const p = path.join(repoRoot, 'data', 'site.json');
    return fs.existsSync(p) ? readJson(p) : null;
  })();

  if (!siteObj) return { ok: true, reason: 'no site.json (prepare not run yet)' };

  const pageSet = siteObj.pageSet || null;
  const packDirRel = pageSet?.globalPagesDir || null;
  if (!packDirRel) return { ok: true, reason: 'no globalPagesDir in page set' };

  const baseDir = path.join(repoRoot, 'data', 'global_pages');
  const packDir = path.join(repoRoot, packDirRel);
  if (!fs.existsSync(packDir)) return { ok: true, reason: `pack global dir missing: ${packDirRel}` };

  const STANDARD_FORBIDDEN_IN_PACK = new Set([
    'about.json',
    'contact.json',
    'disclaimer.json',
    'editorial-policy.json',
    'faq.json',
    'for-providers.json',
    'methodology.json',
    'privacy.json',
  ]);

  const offenders = [];

  const files = fs
    .readdirSync(packDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  for (const f of files) {
    if (STANDARD_FORBIDDEN_IN_PACK.has(f)) {
      offenders.push(
        `FORBIDDEN IN PACK: ${packDirRel}/${f} — must live only in data/global_pages (base). Delete the pack copy.`
      );
      continue;
    }

    const basePath = path.join(baseDir, f);
    const packPath = path.join(packDir, f);
    if (!fs.existsSync(basePath)) continue;

    try {
      const base = readJson(basePath);
      const pack = readJson(packPath);

      const sameTitle = norm(base.title) === norm(pack.title);
      const sameRoute = norm(base.route) === norm(pack.route);
      const sameHtml = norm(base.main_html) === norm(pack.main_html);

      if (sameTitle && sameRoute && sameHtml) {
        offenders.push(
          `DUPLICATE SHADOW COPY: ${packDirRel}/${f} is identical to data/global_pages/${f}. Delete the pack copy.`
        );
      }
    } catch (e) {
      // If JSON is invalid, other validators should catch it.
    }
  }

  if (offenders.length) {
    fail('PACK GLOBAL SHADOW COPIES DETECTED (delete duplicates to prevent drift).', offenders);
  }

  return { ok: true };
}

module.exports = { run };
