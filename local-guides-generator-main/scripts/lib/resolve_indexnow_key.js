const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function fail(msg) {
  throw new Error(msg);
}

function listKeyFiles() {
  return fs.readdirSync(ROOT)
    .filter((name) => /^[a-f0-9]{64}\.txt$/i.test(name))
    .sort();
}

function resolveIndexNowKey() {
  const envKey = (process.env.INDEXNOW_KEY || '').trim();

  if (envKey) {
    const envFile = `${envKey}.txt`;
    const envPath = path.join(ROOT, envFile);
    if (!fs.existsSync(envPath)) fail(`INDEXNOW_KEY is set but root key file is missing: ${envFile}`);
    const body = fs.readFileSync(envPath, 'utf8').trim();
    if (body !== envKey) fail(`INDEXNOW_KEY file content mismatch: ${envFile}`);
    return { key: envKey, keyFile: envFile, keyPath: envPath, source: 'env' };
  }

  const files = listKeyFiles();
  if (files.length === 0) fail('No IndexNow key files found at repo root');
  if (files.length > 1) fail(`Multiple IndexNow key files found at repo root: ${files.join(', ')}`);

  const keyFile = files[0];
  const key = keyFile.replace(/\.txt$/i, '');
  const keyPath = path.join(ROOT, keyFile);
  const body = fs.readFileSync(keyPath, 'utf8').trim();

  if (body !== key) fail(`Root key file content mismatch: ${keyFile}`);

  return { key, keyFile, keyPath, source: 'root' };
}

module.exports = { resolveIndexNowKey };

if (require.main === module) {
  const resolved = resolveIndexNowKey();
  process.stdout.write(JSON.stringify(resolved, null, 2) + '\n');
}
