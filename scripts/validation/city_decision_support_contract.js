const fs = require('fs');
const path = require('path');

function readSite(repoRoot) {
  const fp = path.join(repoRoot, 'data', 'site.json');
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function listCityPages(repoRoot, distDir) {
  if (!fs.existsSync(distDir)) return [];
  const citiesPath = path.join(repoRoot, 'data', 'cities.json');
  let citySlugs = [];
  try {
    citySlugs = JSON.parse(fs.readFileSync(citiesPath, 'utf8')).map((row) => String(row.slug || '').trim()).filter(Boolean);
  } catch (_) {
    citySlugs = [];
  }
  return citySlugs
    .map((slug) => path.join(distDir, slug, 'index.html'))
    .filter((fp) => fs.existsSync(fp));
}

function assertContains(html, needle, label, failures) {
  if (!html.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const site = readSite(repoRoot);
  const pageSetFile = String(site.pageSetFile || '');
  let verticalKey = String(site.vertical || site.verticalKey || '').trim();
  if (!verticalKey && /neuro/i.test(pageSetFile)) verticalKey = 'neuro';
  if (!verticalKey && /uscis_medical/i.test(pageSetFile)) verticalKey = 'uscis_medical';
  if (!verticalKey && /pi/i.test(pageSetFile)) verticalKey = 'pi';
  if (!verticalKey && /trt/i.test(pageSetFile)) verticalKey = 'trt';
  if (!verticalKey && /dentistry/i.test(pageSetFile)) verticalKey = 'dentistry';
  if (!['dentistry', 'neuro', 'uscis_medical', 'trt', 'pi'].includes(verticalKey)) {
    console.log(`ℹ️ CITY DECISION SUPPORT SKIP (${verticalKey || 'unknown'})`);
    return;
  }

  const cityPages = listCityPages(repoRoot, path.join(repoRoot, 'dist'));
  if (!cityPages.length) {
    console.error('CITY DECISION SUPPORT FAIL');
    console.error(' - no city pages found in dist');
    process.exit(1);
  }

  // The decision support a city page owes (rewritten 7 Nov 2026, Search
  // Readiness q1). This contract used to require the four generic cards ("Case
  // type and file fit", "Labs and monitoring" ...), the localized conclusion and
  // the vertical checklist title on every city page: the same ~400 words with
  // the city swapped in, which is why any two city pages were more than half
  // identical. The cards now live once on the guides, and a city page must:
  //   - link the guides that hold them (data-city-decision-links),
  //   - not reprint the generic cards or the localized conclusion,
  //   - on the sites that have city figures (pi, trt, neuro), answer with them:
  //     the citation-summary answer is not the generic comparison sentence and
  //     the page carries its figures (crash census / Medicare table).
  const failures = [];
  const GENERIC_ANSWER = 'four things narrow the field fastest';
  const figures = {
    pi: 'data-city-local-facts="pi"',
    trt: 'data-city-local-facts="trt"',
    neuro: 'data-city-cost-comparison="true"',
  };
  let figurePages = 0;
  for (const sample of cityPages) {
    const html = fs.readFileSync(sample, 'utf8');
    const label = path.relative(repoRoot, sample);
    if (/data-template-fallback="true"/.test(html)) continue;
    assertContains(html, 'data-city-decision-links="true"', label, failures);
    if (html.includes('data-city-support-card=')) failures.push(`${label}: reprints the generic decision cards (they live on the guides)`);
    if (html.includes('data-localized-conclusion="true"')) failures.push(`${label}: reprints the generic localized conclusion`);
    if (figures[verticalKey]) {
      figurePages += 1;
      assertContains(html, figures[verticalKey], label, failures);
      const answer = (html.match(/data-citation-summary-answer="true">([\s\S]*?)<\/p>/) || [])[1] || '';
      if (answer.toLowerCase().includes(GENERIC_ANSWER)) failures.push(`${label}: citation-summary answer is the generic comparison sentence, not the city's figures`);
    }
  }
  if (figures[verticalKey] && !figurePages) failures.push(`no researched ${verticalKey} city page was checked (zero items)`);

  if (failures.length) {
    console.error('CITY DECISION SUPPORT FAIL');
    failures.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  }

  console.log(`✅ CITY DECISION SUPPORT PASS (${verticalKey})`);
}

module.exports = { run };
