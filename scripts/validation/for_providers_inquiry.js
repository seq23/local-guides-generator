/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const EXPECTED_TO = 'info@spryvc.com';
const MAX_UNIQ_MAILTOS = 20;

function fail(msg){
  const err = new Error(msg);
  err._validation = 'FOR_PROVIDERS_INQUIRY';
  throw err;
}

function parseMailto(href){
  const raw = String(href || '').replace(/^mailto:/i,'');
  const [toPart, query=''] = raw.split('?');
  const to = decodeURIComponent(toPart || '').trim();
  const params = new URLSearchParams(query);
  return {
    to,
    subject: decodeURIComponent(params.get('subject') || ''),
    body: decodeURIComponent((params.get('body') || '').replace(/\+/g,'%20')),
    raw
  };
}

function hasMultipleRecipients(to){
  return /[,;\s]/.test(to) && to.split(/[,;\s]+/).filter(Boolean).length > 1;
}

function normalizeBody(body){
  return String(body || '').replace(/\r\n/g,'\n');
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const fp = path.join(repoRoot, 'dist', 'for-providers', 'index.html');

  if (!fs.existsSync(fp)) fail('dist/for-providers/index.html missing. Run build first.');

  const html = fs.readFileSync(fp,'utf8');
  const mailtos = Array.from(html.matchAll(/href=["'](mailto:[^"']+)["']/g)).map(m=>m[1]);
  if (mailtos.length===0) fail('No mailto links found on for-providers page.');

  const parsed = mailtos.map(parseMailto);

  // Hard-fail: multiple recipients anywhere.
  for (const m of parsed){
    if (!m.to) fail('Found mailto with empty recipient.');
    if (hasMultipleRecipients(m.to)) fail(`Mailto has multiple recipients: ${m.to}`);

    // Hard-fail: must route only to our single inbox.
    if (String(m.to).trim().toLowerCase() !== EXPECTED_TO){
      fail(`Mailto recipient must be ${EXPECTED_TO}; found: ${m.to}`);
    }
  }
  const uniq = Array.from(new Set(mailtos));
  if (uniq.length > MAX_UNIQ_MAILTOS) fail(`Found ${uniq.length} distinct mailto links on /for-providers/ (max ${MAX_UNIQ_MAILTOS}).`);

  // Enforce intake-template fields on actual sponsorship inquiry CTAs.
  const mustMention = [
    'Full name:',
    'Work email:',
    'Phone:',
    'Firm name:',
    'Firm type:',
    'Interested in:',
    'Primary markets:',
    'Estimated monthly budget:'
  ];

  const shouldMention = ['How did you find us:'];

  for (const u of uniq){
    const p = parseMailto(u);
    const subject = String(p.subject || '');
    const body = normalizeBody(p.body);

    // Only enforce intake-template fields on actual sponsorship inquiry CTAs.
    // Plain contact/support mailto links are valid but should not trigger template warnings.
    if (!/Sponsorship Inquiry/i.test(subject)) continue;

    for (const line of mustMention){
      if (!body.includes(line)) fail(`A sponsorship inquiry mailto body is missing required line: ${line}`);
    }
    for (const line of shouldMention){
      if (!body.includes(line)) fail(`A sponsorship inquiry mailto body is missing required line: ${line}`);
    }
  }

  console.log('✅ FOR-PROVIDERS INQUIRY PASS');
}

module.exports = { run };
