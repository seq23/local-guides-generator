'use strict';
// Canonical worksheet data feeds both browser printing and committed PDF bytes.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '../..');
const SOURCE = path.join(ROOT, 'data/binders/binders.json');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function load() {
  if (!fs.existsSync(SOURCE)) throw new Error('Missing canonical binder data: data/binders/binders.json');
  const doc = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  if (!Array.isArray(doc.binders) || doc.binders.length !== 2 || new Set(doc.binders.map((b) => b.id)).size !== 2) throw new Error('Expected two distinct binders');
  for (const b of doc.binders) {
    if (!['parent', 'move-in'].includes(b.id) || !b.title || !b.sheets.length) throw new Error('Invalid binder');
    const ids = new Set();
    for (const s of b.sheets) {
      if (!s.id || ids.has(s.id) || !s.title || !s.blocks.length) throw new Error('Invalid or duplicate worksheet');
      ids.add(s.id);
      for (const block of s.blocks) {
        if (!['text', 'fields', 'checklist', 'table'].includes(block.type)) throw new Error('Unknown binder block type');
        if (block.type === 'table' && (!block.columns.length || !Number.isInteger(block.rows) || block.rows < 1)) throw new Error('Invalid worksheet table');
        if (['fields', 'checklist'].includes(block.type) && (!Array.isArray(block.items) || !block.items.length)) throw new Error('Empty worksheet block');
      }
    }
  }
  return doc;
}
const pdfPath = (id) => `/assets/binders/${id}-binder.pdf`;
const downloadHref = (id, from = '/resources/binders/') => `/api/senior-binder-download?binder=${id}&amp;from=${encodeURIComponent(from)}`;
function cta(from = '/guides/') {
  return `<section class="section" data-senior-binder-cta="true"><h2>Keep the paperwork together</h2><p>Print the free Parent Binder or Move-In Binder. Blank worksheets, no email required.</p><p><a class="button button-primary" href="/resources/binders/?from=${encodeURIComponent(from)}">Get the free binder</a></p></section>`;
}
function downloadLink(b) {
  return `<a class="binder-download" data-binder-download="${esc(b.id)}" href="${downloadHref(b.id)}">Download the free ${esc(b.title)} (PDF)</a>`;
}
const assets = '<link rel="stylesheet" href="/assets/binders/binders.css"><script src="/assets/binders/binders.js" defer></script>';
function landing(doc = load()) {
  return `${assets}<article class="binders" data-binder-page="true"><h1>Keep the paperwork together</h1><section data-short-answer="true"><p>Free printable checklists for helping a parent, at home or during a move into care in the Memphis area. Download the Parent Binder to organise contacts and records, or the Move-In Binder to prepare for a move into care. No email or sign-up required.</p></section>${doc.binders.map((b) => `<section class="binder-choice" id="${b.id}"><h2>${esc(b.title)}</h2><p>${esc(b.description)}</p><p>${downloadLink(b)}</p><p><a href="/resources/binders/${b.id}/">Preview and print the ${esc(b.title)}</a> · ${b.sheets.length} pages · US Letter</p><ul>${b.sheets.map((s) => `<li>${esc(s.title)}</li>`).join('')}</ul></section>`).join('')}<p>Print the pages you need, then fill them in by hand. Nothing you write on paper is collected by this website. Keep completed pages private and share only with people your parent chooses.</p><p>${esc(doc.disclaimer)}</p><details><summary>Background sources</summary><ul>${doc.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.title)}</a></li>`).join('')}</ul></details></article>`;
}
function blockHtml(b) {
  if (b.type === 'text') return `<p>${esc(b.text)}</p>`;
  if (b.type === 'checklist') return `<ul class="binder-checklist">${b.items.map((s) => `<li><span aria-hidden="true" class="binder-box"></span>${esc(s)}</li>`).join('')}</ul>`;
  if (b.type === 'fields') return `<div class="binder-fields">${b.items.map((s) => `<div class="binder-field"><span>${esc(s)}</span><span class="binder-line" aria-hidden="true"></span></div>`).join('')}</div>`;
  return `<div class="binder-table-wrap"><table class="binder-table"><thead><tr>${b.columns.map((s) => `<th scope="col">${esc(s)}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: b.rows }, () => `<tr>${b.columns.map(() => '<td>&nbsp;</td>').join('')}</tr>`).join('')}</tbody></table></div>`;
}
function printable(id, doc = load()) {
  const b = doc.binders.find((b) => b.id === id);
  if (!b) throw new Error('Unknown printable binder');
  return `${assets}<article class="binders binder-print" data-binder-page="true"><div class="binder-controls"><a href="/resources/binders/">← Back to free binders</a><h1>${esc(b.title)}</h1><p>${downloadLink(b)}</p><button type="button" data-binder-print>Print or save as PDF</button><p>Use US Letter paper. Choose “Save as PDF” in the print dialog to keep a copy.</p></div>${b.sheets.map((s, i) => `<section class="binder-sheet" data-binder-sheet="${esc(s.id)}"><p class="binder-sheet-label">${esc(b.title)} · ${i + 1} of ${b.sheets.length}</p><h2>${esc(s.title)}</h2>${s.blocks.map(blockHtml).join('')}<footer class="binder-sheet-footer">${esc(doc.disclaimer)}<br>memphisseniorcarehomes.com/resources/binders/</footer></section>`).join('')}</article>`;
}
// Small deterministic PDF writer: built-in Helvetica, US Letter, vector lines and
// checkboxes. No dependency, timestamp, network request or browser needed in CI.
function makePdf(binder, disclaimer) {
  const pages = [];
  const quote = (s) => {
    if (/[^\x20-\x7e]/.test(s)) throw new Error('PDF worksheet text must use printable ASCII');
    return s.replace(/([\\()])/g, '\\$1');
  };
  for (const [index, sheet] of binder.sheets.entries()) {
    const ops = ['0.15 g', '0.5 w'];
    let y = 749;
    const text = (s, size = 14, x = 42, at = y, bold = false) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${at} Td (${quote(s)}) Tj ET`);
    const line = (x1, y1, x2, y2) => ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    const wrapped = (s, size = 14, x = 42, width = 528) => {
      // Helvetica's actual widths are narrower for normal prose; a conservative
      // character budget avoids clipping even with long words.
      const max = Math.floor(width / (size * 0.57));
      let row = '';
      for (const word of s.split(/\s+/)) {
        if (word.length > max) throw new Error('Unbreakable PDF worksheet text');
        if (row && (row + ' ' + word).length > max) { text(row, size, x); y -= size + 5; row = word; }
        else row += (row ? ' ' : '') + word;
      }
      if (row) { text(row, size, x); y -= size + 5; }
    };
    text(`${binder.title} | ${index + 1} of ${binder.sheets.length}`, 11); y -= 33;
    text(sheet.title, 23, 42, y, true); y -= 31;
    for (const b of sheet.blocks) {
      if (b.type === 'text') { wrapped(b.text); y -= 10; }
      else if (b.type === 'fields') {
        for (const label of b.items) { text(label, 13); y -= 23; line(42, y, 570, y); y -= 25; }
      } else if (b.type === 'checklist') {
        for (const item of b.items) {
          ops.push(`42 ${y - 1} 10 10 re S`);
          wrapped(item, 14, 62, 508); y -= 10;
        }
      } else if (b.type === 'table') {
        const w = 528 / b.columns.length;
        const top = y + 8;
        for (const [i, col] of b.columns.entries()) text(col, 11, 48 + i * w, y - 8, true);
        y -= 28;
        for (let i = 0; i <= b.rows; i++) { line(42, y, 570, y); if (i < b.rows) y -= 38; }
        line(42, top, 570, top);
        for (let i = 0; i <= b.columns.length; i++) line(42 + i * w, top, 42 + i * w, y);
        y -= 24;
      }
    }
    if (y < 85) throw new Error(`Worksheet overflows US Letter: ${binder.id}/${sheet.id} (${y})`);
    text(disclaimer, 10, 42, 48);
    text('memphisseniorcarehomes.com/resources/binders/', 10, 42, 32);
    pages.push(ops.join('\n'));
  }
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const kids = [];
  for (const stream of pages) {
    const n = objects.length;
    kids.push(`${n} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${n + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[2] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.join(' ')}] >>`;
  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let n = 1; n < objects.length; n++) { offsets.push(Buffer.byteLength(out)); out += `${n} 0 obj\n${objects[n]}\nendobj\n`; }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}
function pdfs(doc = load()) { return doc.binders.map((b) => ({ file: path.join(ROOT, pdfPath(b.id)), bytes: makePdf(b, doc.disclaimer) })); }
function verifyPdfs() {
  for (const { file, bytes } of pdfs()) if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) throw new Error('Binder PDF missing or stale; run npm run binders:generate');
}
module.exports = { load, cta, landing, printable, makePdf, pdfs, verifyPdfs };
