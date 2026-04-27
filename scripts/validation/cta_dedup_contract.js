#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.log('CTA DEDUP CONTRACT SKIP (no dist)');
  process.exit(0);
}
const htmlFiles = [];
(function walk(dir){
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
  }
})(distDir);
let failures = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file,'utf8');
  const ctas = (html.match(/data-primary-conversion-cta="true"/g) || []).length + (html.match(/data-inline-conversion-cta="true"/g) || []).length;
  if (ctas > 2) failures.push(`${path.relative(distDir,file)} has ${ctas} conversion CTA sections`);
}
if (failures.length) {
  console.error('❌ CTA DEDUP CONTRACT FAIL');
  failures.slice(0,20).forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('✅ CTA DEDUP CONTRACT PASS');
