const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  dentistry: { maxGenericShare: 0.17, requiredRoutes: ['/guides/dental-crowns/', '/guides/root-canal-treatment/', '/guides/dental-red-flags/', '/guides/questions-to-ask/'] },
  neuro: { maxGenericShare: 0.17, requiredRoutes: ['/guides/neuro-evaluation-pricing/', '/guides/neuro-provider-red-flags/', '/guides/questions-to-ask-before-neuro-testing/', '/guides/what-to-expect-after-a-neuro-evaluation/'] },
  trt: { maxGenericShare: 0.16, requiredRoutes: ['/guides/who-is-a-good-candidate-for-trt/', '/guides/trt-pricing-and-labs/', '/guides/trt-red-flags/', '/guides/trt-side-effects-and-safety/', '/guides/trt-telehealth-vs-local-clinic/'] },
  pi: { maxGenericShare: 0.18, requiredRoutes: ['/guides/what-to-do-after-an-accident/', '/guides/evidence-checklist-after-an-accident/', '/guides/personal-injury-fees-explained/', '/guides/personal-injury-lawyer-red-flags/', '/guides/when-to-call-a-personal-injury-lawyer/'] },
  uscis_medical: { maxGenericShare: 0.30, requiredRoutes: [] }
};

const GENERIC_DESTINATIONS = new Set(['/', '/guides/', '/faq/', '/request-assistance/', '/personal-injury/', '/guides/#costs', '/guides/#questions', '/guides/#red-flags', '/states/']);

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

  if (verticalKey === 'trt') {
    const keyRoutes = ['/guides/who-is-a-good-candidate-for-trt/', '/guides/trt-pricing-and-labs/', '/guides/trt-red-flags/', '/guides/trt-side-effects-and-safety/', '/guides/trt-telehealth-vs-local-clinic/'];
    const sum = keyRoutes.reduce((acc, route) => acc + (routeCounts.get(route) || 0), 0);
    if (totalItems && (sum / totalItems) < 0.30) issues.push(`trt: key routing share ${(sum / totalItems * 100).toFixed(1)}% is below 30.0%`);
  }

  if (issues.length) {
    console.error('FANOUT DISTRIBUTION FAIL');
    issues.forEach((issue) => console.error(` - ${issue}`));
    process.exit(1);
  }

  console.log(`✅ FANOUT DISTRIBUTION PASS (${verticalKey}) — generic share ${(genericShare * 100).toFixed(1)}%`);
}

module.exports = { run };
