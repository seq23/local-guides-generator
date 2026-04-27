const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  dentistry: { maxGenericShare: 0.15, requiredRoutes: ['/guides/dental-implants/', '/guides/veneers/', '/guides/dental-red-flags/', '/guides/questions-to-ask/', '/guides/dental-second-opinion/', '/guides/emergency-dentist-vs-waiting/'] },
  neuro: { maxGenericShare: 0.14, requiredRoutes: ['/guides/neuro-evaluation-pricing/', '/guides/neuro-provider-red-flags/', '/guides/questions-to-ask-before-neuro-testing/', '/guides/what-to-expect-after-a-neuro-evaluation/'] },
  trt: { maxGenericShare: 0.14, requiredRoutes: ['/guides/testosterone-replacement-therapy-overview/', '/guides/who-is-a-good-candidate-for-trt/', '/guides/trt-pricing-and-labs/', '/guides/trt-red-flags/', '/guides/trt-side-effects-and-safety/', '/guides/trt-telehealth-vs-local-clinic/', '/guides/peptides-vs-trt/', '/guides/are-peptides-safe/', '/guides/peptide-program-costs/', '/guides/medical-weight-loss-programs-overview/', '/guides/medical-weight-loss-pricing/', '/guides/testosterone-and-hair-loss-explained/', '/guides/peptide-clinic-red-flags/', '/guides/iv-hydration-therapy-overview/', '/guides/iv-hydration-red-flags/'] },
  pi: { maxGenericShare: 0.16, requiredRoutes: ['/guides/what-to-do-after-an-accident/', '/guides/evidence-checklist-after-an-accident/', '/guides/recorded-statements-and-insurance-calls/', '/guides/personal-injury-fees-explained/', '/guides/personal-injury-lawyer-red-flags/', '/guides/questions-to-ask-a-personal-injury-lawyer/', '/guides/when-to-call-a-personal-injury-lawyer/', '/guides/car-accidents/', '/guides/truck-accidents/', '/guides/motorcycle-accidents/', '/guides/slip-and-fall/', '/guides/dog-bites/', '/guides/pedestrian-accidents/', '/guides/bicycle-accidents/', '/guides/rideshare-accidents/', '/guides/premises-liability/', '/guides/product-liability/', '/guides/workplace-injuries/', '/guides/brain-injury/', '/guides/spinal-cord-injury/', '/guides/medical-malpractice/', '/guides/nursing-home-abuse/', '/guides/burn-injury/', '/guides/bus-accidents/', '/guides/catastrophic-injury/', '/guides/bystander-injuries-near-law-enforcement/', '/guides/injuries-during-immigration-enforcement/', '/guides/vehicle-collisions-near-law-enforcement-activity/'] },
  uscis_medical: { maxGenericShare: 0.18, requiredRoutes: ['/guides/costs-and-timeframes/', '/guides/document-checklist/', '/guides/i-693-medical-exam-requirements/', '/guides/questions-to-ask-a-civil-surgeon/', '/guides/after-your-exam-next-steps/'] }
};

const GENERIC_DESTINATIONS = new Set(['/', '/guides/', '/faq/', '/request-assistance/', '/personal-injury/', '/guides/#costs', '/guides/#questions', '/guides/#red-flags']);

function loadFanoutPayload(repoRoot) {
  const fp = path.join(repoRoot, 'dist', '_fanout_query_clusters.json');
  if (!fs.existsSync(fp)) {
    console.error('FANOUT DISTRIBUTION FAIL');
    console.error(' - dist/_fanout_query_clusters.json is missing');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const payload = loadFanoutPayload(repoRoot);
  const verticalKey = String(payload.verticalKey || '').trim();
  const rule = THRESHOLDS[verticalKey] || { maxGenericShare: 0.25, requiredRoutes: [] };
  const routeCounts = new Map();
  let totalItems = 0;
  let genericItems = 0;
  const issues = [];

  for (const record of Array.isArray(payload.records) ? payload.records : []) {
    for (const group of Array.isArray(record.groups) ? record.groups : []) {
      for (const item of Array.isArray(group.items) ? group.items : []) {
        const query = String(item.query || '');
        const href = String(item.href || '');
        totalItems += 1;
        routeCounts.set(href, (routeCounts.get(href) || 0) + 1);
        if (/\{[a-zA-Z]+\}/.test(query) || /\{\{[^}]+\}\}/.test(query)) {
          issues.push(`literal placeholder leaked into fanout query: ${query}`);
        }
        if (GENERIC_DESTINATIONS.has(href)) genericItems += 1;
      }
    }
  }

  if (totalItems === 0) issues.push('no fanout items were generated');
  const genericShare = totalItems ? genericItems / totalItems : 1;
  if (genericShare > rule.maxGenericShare) {
    issues.push(`${verticalKey}: generic destination share ${(genericShare * 100).toFixed(1)}% exceeds ${(rule.maxGenericShare * 100).toFixed(1)}%`);
  }

  for (const route of rule.requiredRoutes) {
    if (!routeCounts.has(route)) issues.push(`${verticalKey}: required fanout destination missing ${route}`);
  }

  if (verticalKey === 'dentistry') {
    const keyRoutes = ['/guides/dental-implants/', '/guides/veneers/', '/guides/dental-red-flags/', '/guides/questions-to-ask/', '/guides/dental-second-opinion/'];
    const sum = keyRoutes.reduce((acc, route) => acc + (routeCounts.get(route) || 0), 0);
    if (totalItems && (sum / totalItems) < 0.30) issues.push(`dentistry: key routing share ${(sum / totalItems * 100).toFixed(1)}% is below 30.0%`);
  }

  if (verticalKey === 'trt') {
    const keyRoutes = ['/guides/testosterone-replacement-therapy-overview/', '/guides/who-is-a-good-candidate-for-trt/', '/guides/trt-pricing-and-labs/', '/guides/trt-red-flags/', '/guides/trt-side-effects-and-safety/', '/guides/trt-telehealth-vs-local-clinic/', '/guides/peptides-vs-trt/', '/guides/are-peptides-safe/', '/guides/peptide-program-costs/', '/guides/medical-weight-loss-pricing/', '/guides/testosterone-and-hair-loss-explained/'];
    const sum = keyRoutes.reduce((acc, route) => acc + (routeCounts.get(route) || 0), 0);
    if (totalItems && (sum / totalItems) < 0.30) issues.push(`trt: key routing share ${(sum / totalItems * 100).toFixed(1)}% is below 30.0%`);
  }

  if (verticalKey === 'pi') {
    const keyRoutes = ['/guides/what-to-do-after-an-accident/', '/guides/evidence-checklist-after-an-accident/', '/guides/recorded-statements-and-insurance-calls/', '/guides/personal-injury-fees-explained/', '/guides/personal-injury-lawyer-red-flags/', '/guides/questions-to-ask-a-personal-injury-lawyer/', '/guides/when-to-call-a-personal-injury-lawyer/', '/guides/car-accidents/', '/guides/truck-accidents/', '/guides/motorcycle-accidents/', '/guides/slip-and-fall/', '/guides/dog-bites/', '/guides/pedestrian-accidents/', '/guides/bicycle-accidents/', '/guides/rideshare-accidents/', '/guides/premises-liability/', '/guides/product-liability/', '/guides/workplace-injuries/', '/guides/brain-injury/', '/guides/spinal-cord-injury/', '/guides/medical-malpractice/', '/guides/nursing-home-abuse/', '/guides/burn-injury/', '/guides/bus-accidents/', '/guides/catastrophic-injury/', '/guides/bystander-injuries-near-law-enforcement/', '/guides/injuries-during-immigration-enforcement/', '/guides/vehicle-collisions-near-law-enforcement-activity/'];
    const sum = keyRoutes.reduce((acc, route) => acc + (routeCounts.get(route) || 0), 0);
    if (totalItems && (sum / totalItems) < 0.35) issues.push(`pi: key routing share ${(sum / totalItems * 100).toFixed(1)}% is below 35.0%`);
  }

  if (issues.length) {
    console.error('FANOUT DISTRIBUTION FAIL');
    issues.forEach((issue) => console.error(` - ${issue}`));
    process.exit(1);
  }

  console.log(`✅ FANOUT DISTRIBUTION PASS (${verticalKey}) — generic share ${(genericShare * 100).toFixed(1)}%`);
}

module.exports = { run };
