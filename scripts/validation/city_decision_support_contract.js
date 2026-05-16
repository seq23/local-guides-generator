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

  const failures = [];
  const verticalLocalChecklistTitles = {
    dentistry: 'Local dentist selection and payment checklist',
    neuro: 'City-specific neuro evaluation decision checklist',
    uscis_medical: 'Local civil surgeon comparison checklist',
    trt: 'Local TRT and hormone clinic authority checklist'
  };

  for (const sample of cityPages) {
    const html = fs.readFileSync(sample, 'utf8');
    const label = path.relative(repoRoot, sample);
    assertContains(html, 'data-city-decision-support="true"', label, failures);
    assertContains(html, 'data-city-decision-links="true"', label, failures);
    assertContains(html, 'data-localized-conclusion="true"', label, failures);

    if (verticalLocalChecklistTitles[verticalKey]) {
      assertContains(html, 'data-city-local-checklist="true"', label, failures);
      assertContains(html, verticalLocalChecklistTitles[verticalKey], label, failures);
    }

    if (verticalKey === 'dentistry') {
      assertContains(html, 'data-city-treatment-scope="true"', label, failures);
      assertContains(html, 'data-city-pricing-clarity="true"', label, failures);
      assertContains(html, 'data-city-specialist-fit="true"', label, failures);
      assertContains(html, 'data-city-second-opinion-check="true"', label, failures);
    }

    if (verticalKey === 'neuro') {
      assertContains(html, 'data-city-pricing-expectations="true"', label, failures);
      assertContains(html, 'data-city-report-expectations="true"', label, failures);
      assertContains(html, 'data-city-records-expectations="true"', label, failures);
      assertContains(html, 'data-city-next-step-expectations="true"', label, failures);
    }

    if (verticalKey === 'uscis_medical') {
      assertContains(html, 'data-city-authorization-check="true"', label, failures);
      assertContains(html, 'data-city-document-check="true"', label, failures);
      assertContains(html, 'data-city-turnaround-check="true"', label, failures);
      assertContains(html, 'data-city-after-exam-check="true"', label, failures);
    }

    if (verticalKey === 'trt') {
      assertContains(html, 'data-city-candidacy-clarity="true"', label, failures);
      assertContains(html, 'data-city-monitoring-clarity="true"', label, failures);
      assertContains(html, 'data-city-treatment-selection="true"', label, failures);
      assertContains(html, 'data-city-trust-checks="true"', label, failures);
    }

    if (verticalKey === 'pi') {
      assertContains(html, 'data-city-case-fit-clarity="true"', label, failures);
      assertContains(html, 'data-city-fee-clarity="true"', label, failures);
      assertContains(html, 'data-city-evidence-timing="true"', label, failures);
      assertContains(html, 'data-city-insurance-caution="true"', label, failures);
    }
  }

  if (failures.length) {
    console.error('CITY DECISION SUPPORT FAIL');
    failures.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  }

  console.log(`✅ CITY DECISION SUPPORT PASS (${verticalKey})`);
}

module.exports = { run };
