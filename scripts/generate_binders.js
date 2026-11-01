#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pdfs, verifyPdfs } = require('./lib/senior_binders');
if (process.argv.includes('--check')) verifyPdfs();
else {
  // Render and validate EVERY sheet before writing either binder.
  const candidates = pdfs();
  for (const { file, bytes } of candidates) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
}
console.log('Binder PDFs: canonical worksheets and printable assets agree');
