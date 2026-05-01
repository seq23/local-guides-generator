const fs = require('fs');
const path = require('path');
const buyouts = require('../helpers/buyouts');
function fail(msg) { throw new Error('BUYOUT RUNTIME CTA FAIL: ' + msg); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function hasAdjCta(html) { return /<section[^>]*data-(?:primary-conversion-cta|inline-conversion-cta|runtime-next-steps-cta)=\"true\"[\s\S]*?<\/section>\s*<section[^>]*data-(?:primary-conversion-cta|inline-conversion-cta|runtime-next-steps-cta)=\"true\"[\s\S]*?<\/section>/i.test(String(html||'')); }
function run() {
 const repoRoot = path.join(__dirname, '..', '..');
 const distRoot = path.join(repoRoot, 'dist');
 const buyoutPath = path.join(repoRoot, 'data', 'buyouts.json');
 if (!fs.existsSync(buyoutPath)) { console.log('✅ BUYOUT RUNTIME CTA SKIP (no buyouts.json)'); return; }
 let arr = [];
 try { arr = JSON.parse(read(buyoutPath)); } catch (e) { fail('invalid JSON in data/buyouts.json: ' + e.message); }
 if (!Array.isArray(arr) || arr.length === 0) { console.log('✅ BUYOUT RUNTIME CTA SKIP (no configured buyouts)'); return; }
 const now = new Date();
 const active = arr.filter((b) => buyouts.isLive(b, now));
 if (!active.length) { console.log('✅ BUYOUT RUNTIME CTA SKIP (no live buyouts)'); return; }
 const candidates = [path.join(distRoot, 'index.html')];
 for (const fp of candidates.filter(fs.existsSync)) { const html = read(fp); if (hasAdjCta(html)) fail(path.relative(repoRoot, fp) + ' contains adjacent CTA sections without content separation.'); }
 console.log('✅ BUYOUT RUNTIME CTA PASS');
}
module.exports = { run };