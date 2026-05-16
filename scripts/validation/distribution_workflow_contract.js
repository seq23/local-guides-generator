const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
function fail(msg){ console.error('DISTRIBUTION WORKFLOW CONTRACT FAIL'); console.error('- ' + msg); process.exit(1); }
function has(p, s){ const fp=path.join(root,p); return fs.existsSync(fp) && fs.readFileSync(fp,'utf8').includes(s); }
function file(p){ const fp=path.join(root,p); if(!fs.existsSync(fp)) fail(`missing required file: ${p}`); return fs.readFileSync(fp,'utf8'); }
const workflow = file('.github/workflows/deploy-distribution.yml');
const deploy = file('distribution_scripts/deploy_distribution.sh');
const submit = file('distribution_scripts/indexnow_submit.sh');
for (const pack of ['pi_v1.json','dentistry_v1.json','neuro_v1.json','trt_v1.json','uscis_medical_v1.json']) {
  if (!workflow.includes(`data/page_sets/examples/${pack}`)) fail(`workflow missing explicit pack matrix item: ${pack}`);
}
if (!workflow.includes('workflow_dispatch')) fail('workflow missing manual dispatch');
if (!workflow.includes('branches: [main]')) fail('workflow missing push-to-main trigger');
if (!workflow.includes('npm run validate:indexnow')) fail('workflow does not validate IndexNow artifacts before deploy');
if (!workflow.includes('npm run validate:distribution-workflow')) fail('workflow does not validate its own distribution contract');
if (!workflow.includes('secrets.INDEXNOW_KEY')) fail('workflow does not source INDEXNOW_KEY from GitHub secrets');
if (!workflow.includes('secrets.GSC_SERVICE_ACCOUNT_JSON') || !workflow.includes('GSC_SERVICE_ACCOUNT_JSON_PRESENT')) fail('workflow does not make GSC optional/non-blocking');
if (!deploy.includes('== 1) Submit IndexNow priority URLs ==')) fail('deploy script does not submit IndexNow priority first');
if (!deploy.includes('Optional Google sitemap submit')) fail('deploy script does not keep GSC optional');
if (!deploy.includes('reports/indexnow-submit-report.json')) fail('deploy script does not write aggregate IndexNow report');
if (!submit.includes('reports/') || !submit.includes('dryRun') || !submit.includes('api.indexnow.org/indexnow')) fail('submit script lacks report/dry-run/API support');
console.log('DISTRIBUTION WORKFLOW CONTRACT PASS');
