// One loader for functions/api/request-assistance.js in tests. The endpoint is
// a .js file in a CommonJS package, so it is copied to a temp .mjs; its
// relative ../../lib/ imports are pointed at the real lib/ files so the copy
// runs exactly the code Cloudflare bundles.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = pathToFileURL(path.join(ROOT, 'lib')).href;

export function loadRequestAssistance(prefix = 'ra-fn-') {
  const src = fs.readFileSync(path.join(ROOT, 'functions/api/request-assistance.js'), 'utf8');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), prefix)), 'request-assistance.mjs');
  fs.writeFileSync(tmp, src.replace(/(['"])\.\.\/\.\.\/lib\//g, `$1${LIB}/`));
  return import(pathToFileURL(tmp).href);
}
