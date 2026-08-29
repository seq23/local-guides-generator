const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`WORKFLOW INTEGRITY FAIL: ${msg}`);
  process.exit(1);
}

function mustExist(rel) {
  const abs = path.join(process.cwd(), rel);
  if (!fs.existsSync(abs)) fail(`missing required file: ${rel}`);
  return abs;
}

function run() {
  const root = process.cwd();

  const requiredWorkflows = [
    '.github/workflows/distribution.yml',
    '.github/workflows/ingestion_sync.yml',
    '.github/workflows/integrity_build.yml',
    '.github/workflows/promote_reference.yml',
    '.github/workflows/refresh-verification-page.yml',
    '.github/workflows/rotating_refresh.yml',
    '.github/workflows/validate.yml',
  ];
  requiredWorkflows.forEach(mustExist);

  mustExist('scripts/automation/refresh_verification_page.sh');
  mustExist('scripts/automation/refresh_verification_page.js');
  mustExist('scripts/automation/rotate_vertical_refresh.js');

  const refreshWorkflow = fs.readFileSync(
    path.join(root, '.github/workflows/refresh-verification-page.yml'),
    'utf8'
  );

  const rotatingWorkflow = fs.readFileSync(
    path.join(root, '.github/workflows/rotating_refresh.yml'),
    'utf8'
  );

  const rotateScript = fs.readFileSync(
    path.join(root, 'scripts/automation/rotate_vertical_refresh.js'),
    'utf8'
  );

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts['refresh:verification']) {
    fail('package.json missing refresh:verification script');
  }

  // refresh-verification workflow must use the safe pipeline
  if (!/npm run refresh:verification/.test(refreshWorkflow)) {
    fail('refresh-verification workflow must call npm run refresh:verification');
  }

  // rotating workflow must not call the raw refresh script directly
  if (/node scripts\/automation\/refresh_verification_page\.js/.test(rotatingWorkflow)) {
    fail('rotating_refresh.yml must not call refresh_verification_page.js directly; use npm run refresh:verification');
  }

  // rotating workflow must still invoke the rotating entrypoint
  if (!/node scripts\/automation\/rotate_vertical_refresh\.js/.test(rotatingWorkflow)) {
    fail('rotating_refresh.yml must invoke rotate_vertical_refresh.js');
  }

  // rotate script must not call the raw refresh script directly
  if (/node scripts\/automation\/refresh_verification_page\.js/.test(rotateScript)) {
    fail('rotate_vertical_refresh.js must not call refresh_verification_page.js directly; use npm run refresh:verification');
  }

  // rotate script must use the safe refresh pipeline
  if (!/npm run refresh:verification/.test(rotateScript)) {
    fail('rotate_vertical_refresh.js must call npm run refresh:verification');
  }

  // rotate script must materialize pack context before refresh
  if (!/node scripts\/build_city_sites\.js --page-set/.test(rotateScript)) {
    fail('rotate_vertical_refresh.js must build/materialize the chosen page set before refresh:verification');
  }

  // rotate script must define page-set mappings for rotating verticals
  if (!/const pageSetMap = \{/.test(rotateScript)) {
    fail('rotate_vertical_refresh.js must define pageSetMap for rotating verticals');
  }

  // rotate script must bootstrap site.json somehow when missing
  if (!/site\.json/.test(rotateScript)) {
    fail('rotate_vertical_refresh.js must handle bootstrapping data/site.json when missing');
  }

  // acceptable controlled bootstrap sources:
  // 1) data/site.template.json
  // 2) hardcoded pack config map / JSON write path
  const usesTemplateBootstrap = /site\.template\.json/.test(rotateScript);
  const usesControlledPackBootstrap =
    /JSON\.stringify\(/.test(rotateScript) &&
    /brandName/.test(rotateScript) &&
    /siteUrl/.test(rotateScript) &&
    /pageSetFile/.test(rotateScript);

  if (!usesTemplateBootstrap && !usesControlledPackBootstrap) {
    fail('rotate_vertical_refresh.js must bootstrap data/site.json from a controlled source when missing');
  }

  // refresh workflow should still indicate dependent artifact regeneration path
  if (!/refresh:verification|sitemap_emit/.test(refreshWorkflow)) {
    fail('refresh-verification workflow does not regenerate dependent artifacts');
  }

  // Every workflow must run the same Node major.
  //
  // build_starter_pack.yml pinned '20' while the other ten pinned '24'. Nothing
  // failed, which is exactly why it survived: one lane quietly ran `npm ci` and
  // the build scripts on a different major from every other lane, so a script
  // using anything newer than Node 20 would break there and nowhere else. Two
  // components each keeping their own version, with nothing linking them.
  const wfDir = path.join(root, '.github/workflows');
  const versions = new Map();
  let wfWithNode = 0;
  for (const name of fs.readdirSync(wfDir)) {
    if (!/\.ya?ml$/.test(name)) continue;
    const body = fs.readFileSync(path.join(wfDir, name), 'utf8');
    for (const m of body.matchAll(/node-version:\s*['"]?([\w.]+)['"]?/g)) {
      wfWithNode += 1;
      if (!versions.has(m[1])) versions.set(m[1], []);
      versions.get(m[1]).push(name);
    }
  }
  if (wfWithNode === 0) {
    fail('no workflow pins a node-version; the node consistency check examined nothing');
  }
  if (versions.size > 1) {
    const detail = [...versions.entries()]
      .map(([v, files]) => `${v}: ${files.join(', ')}`)
      .join(' | ');
    fail(
      'workflows disagree on the Node major they run. A lane on a different major ' +
      `runs npm ci and the build scripts differently from every other lane. ${detail}`
    );
  }

  // The warning tier must be invoked by a workflow. It is defined in
  // data/contracts/validator_tiering_policy.json and has a runner, but nothing
  // in .github/workflows ran it: its 8 validators were reachable only through
  // `npm run qa:final`, which no workflow runs either. A warning tier nothing
  // runs emits no warnings, which is the only thing it is for.
  //
  // Comment lines are stripped before matching. The first version of this check
  // did not strip them, and its own explanatory comment in validate.yml
  // contained the string it searched for -- so it passed by reading its own
  // description of the problem instead of an actual invocation. A guard
  // satisfied by a comment about the thing it guards.
  const allWorkflows = fs.readdirSync(wfDir)
    .filter((n) => /\.ya?ml$/.test(n))
    .map((n) => fs.readFileSync(path.join(wfDir, n), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  if (!/validate:tier:warning|run_validator_tier\.js warning|qa:final/.test(allWorkflows)) {
    fail(
      'no workflow invokes the warning validator tier. It is declared in ' +
      'data/contracts/validator_tiering_policy.json with a runner behind it, so leaving it ' +
      'uninvoked means those validators never report anything.'
    );
  }

  // ...and .nvmrc must name that same major, or local development runs a
  // different Node from every CI lane. It said 20.20.0 while CI ran 24.
  const ciMajor = [...versions.keys()][0].split('.')[0];
  const nvmrcPath = path.join(root, '.nvmrc');
  if (fs.existsSync(nvmrcPath)) {
    const nvmrcMajor = fs.readFileSync(nvmrcPath, 'utf8').trim().replace(/^v/, '').split('.')[0];
    if (nvmrcMajor && nvmrcMajor !== ciMajor) {
      fail(
        `.nvmrc pins Node ${nvmrcMajor} but every workflow runs Node ${ciMajor}. Local development ` +
        'would run a different major from CI, so a break can only ever show up on one side.'
      );
    }
  }

  console.log(
    `✅ WORKFLOW INTEGRITY CONTRACT PASS (${wfWithNode} node-version pins + .nvmrc, all node ${ciMajor})`
  );
}

module.exports = { run };
