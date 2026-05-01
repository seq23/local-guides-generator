#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cssPath = path.join(process.cwd(), 'assets', 'styles.css');
const basePath = path.join(process.cwd(), 'templates', 'base.html');
const footerPath = path.join(process.cwd(), 'templates', 'partials', 'footer.html');
const css = fs.readFileSync(cssPath,'utf8');
const base = fs.readFileSync(basePath,'utf8');
const footer = fs.readFileSync(footerPath,'utf8');
const failures = [];
if (base.includes('<div class="container">\n    %%FOOTER%%\n  </div>')) failures.push('Footer is still wrapped in a constrained container in base.html');
if (!footer.includes('class="site-footer"')) failures.push('Footer partial is missing site-footer class');
if (!css.includes('.site-footer')) failures.push('styles.css missing site-footer rules');
if (!css.includes('width: 100vw')) failures.push('site-footer is not full-width');
if (!css.includes('font-size: 12px')) failures.push('footer typography not reduced to 12px');
if (failures.length) {
  console.error('❌ FOOTER WEIGHT CONTRACT FAIL');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('✅ FOOTER WEIGHT CONTRACT PASS');
