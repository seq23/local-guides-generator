/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const buyouts = require('../helpers/buyouts');
const sponsorCatalog = require('../helpers/sponsor_catalog');

function fail(lines) {
  throw new Error('PRODUCTION SPONSOR FIXTURE CONTRACT FAIL\n' + lines.join('\n'));
}

function readJson(fp, fallback) {
  if (!fs.existsSync(fp)) return fallback;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function collectTrainingFixtureSlugs(repoRoot) {
  const training = readJson(path.join(repoRoot, 'data', 'training', 'sponsorships.json'), {});
  const slugs = new Set((training.fixture_sponsor_slugs || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean));
  for (const slug of Object.keys(training.training_fixture_sponsors || {})) slugs.add(String(slug).trim().toLowerCase());
  return slugs;
}

function looksLikeFixtureSponsor(sponsor) {
  const name = String(sponsor && sponsor.display_name || '');
  const phone = String(sponsor && sponsor.phone || '');
  const website = String(sponsor && sponsor.website_url || sponsor && sponsor.website || '');
  return sponsor && sponsor.fixture_only === true ||
    /\bacme\b/i.test(name) ||
    /(?:^|\D)(?:\+?1[-. ]?)?555[-. ]555[-. ]5555(?:\D|$)/.test(phone) ||
    /(^|\.)example\.(com|org|net)(?:\/|$)/i.test(website);
}

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(fp, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(fp);
  }
  return out;
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const env = String(process.env.LKG_ENV || 'baseline').trim().toLowerCase();
  if (env === 'training') {
    console.log('✅ PRODUCTION SPONSOR FIXTURE CONTRACT SKIP (training environment)');
    return;
  }

  const catalog = sponsorCatalog.loadSponsorCatalog(repoRoot);
  const fixtureSlugs = collectTrainingFixtureSlugs(repoRoot);
  const active = buyouts.loadBuyouts(repoRoot).filter((rec) => buyouts.isLive(rec, new Date()));
  const bad = [];

  for (const rec of active) {
    const slug = String(rec.sponsor_slug || '').trim().toLowerCase();
    const sponsor = catalog[slug] || null;
    if (fixtureSlugs.has(slug)) bad.push(`live production buyout ${rec.id || slug} uses training fixture sponsor ${slug}`);
    if (sponsor && Array.isArray(sponsor.allowed_environments) && !sponsor.allowed_environments.map((v) => String(v).toLowerCase()).includes(env)) {
      bad.push(`live production buyout ${rec.id || slug} uses sponsor ${slug} outside allowed_environments`);
    }
    if (looksLikeFixtureSponsor(sponsor)) bad.push(`live production buyout ${rec.id || slug} uses fixture-like sponsor data for ${slug}`);
  }

  const fixtureText = [/\bACME Law\b/i, /\+?1?-?555-555-5555/i];
  const pages = walkHtml(path.join(repoRoot, 'dist'));
  let sponsoredSurfaces = 0;
  for (const fp of pages) {
    const html = fs.readFileSync(fp, 'utf8');
    if (!/data-sponsored-surface=/i.test(html)) continue;
    sponsoredSurfaces += 1;
    for (const pattern of fixtureText) {
      if (pattern.test(html)) bad.push(`${path.relative(repoRoot, fp)} renders fixture sponsor content in a production build`);
    }
  }

  // Rule 0. Zero LIVE BUYOUTS is a legitimate empty set -- none are sold, and
  // the first loop honestly has nothing to walk. Zero RENDERED PAGES is not:
  // the second loop is the half that actually guards production output, and
  // with no dist it scanned nothing and still printed PASS. Worse, the PASS
  // line only ever reported the buyout count, so a scan of zero pages was
  // indistinguishable from a clean scan of the whole site.
  //
  // Every lane that runs this validator builds first (build_all_packs.js runs
  // the tier per pack; validate.yml, integrity_build.yml, add_city_request.yml,
  // complete_promoted_guides.yml and ingestion_sync.yml all build before
  // validating), so an absent dist here means the gate is being asked to vouch
  // for output that does not exist.
  if (!pages.length) {
    fail([
      'examined 0 rendered pages: dist/ is absent or contains no HTML, so this contract',
      'cannot vouch for the production build. It previously passed in this state while',
      'reporting only the buyout count, which hid the fact that nothing was scanned.',
      'Run a build (node scripts/build_all_packs.js) before this validator.',
    ]);
  }

  if (bad.length) fail([...new Set(bad)]);
  console.log(
    `✅ PRODUCTION SPONSOR FIXTURE CONTRACT PASS (${active.length} active production buyouts, ` +
      `${sponsoredSurfaces} sponsored surface(s) across ${pages.length} rendered page(s) scanned)`
  );
}

if (require.main === module) {
  try { run({}); } catch (err) { console.error(err.message); process.exit(1); }
}

module.exports = { run, collectTrainingFixtureSlugs, looksLikeFixtureSponsor };
