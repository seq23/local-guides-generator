#!/usr/bin/env bash
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
MODE="${1:-batch}"
INDEXNOW_MODE="$MODE" python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
import sys
sys.path.insert(0, str(Path('distribution_scripts').resolve()))
from distribution_common import load_config, read_urls, split_urls_by_host, chunked

config = load_config()
idx = config.get('indexnow', {})
hosts = idx.get('hosts', [])
key = str(idx.get('key', '')).strip()
key_file = str(idx.get('key_file', '')).strip()
chunk_size = int(idx.get('chunk_size', 100))
mode = os.environ.get('INDEXNOW_MODE', 'batch').strip().lower()
if mode not in {'batch', 'priority'}:
    raise SystemExit(f'Unsupported mode: {mode}')
source_file = Path(idx.get('priority_file' if mode == 'priority' else 'batch_file', ''))
if not source_file.exists():
    raise SystemExit(f'URL file not found: {source_file}')
if not key:
    raise SystemExit('distribution.config.json missing indexnow.key')
if not key_file:
    raise SystemExit('distribution.config.json missing indexnow.key_file')
key_path = Path(key_file)
if not key_path.exists():
    raise SystemExit(f'Committed IndexNow key file missing: {key_file}')
if key_path.read_text(encoding='utf-8').strip() != key:
    raise SystemExit(f'Committed IndexNow key file does not match configured key: {key_file}')
urls = read_urls(source_file)
by_host = split_urls_by_host(urls, hosts)
submitted = 0
for host, host_urls in by_host.items():
    if not host_urls:
        continue
    for batch in chunked(host_urls, chunk_size):
        payload = {
            'host': host,
            'key': key,
            'keyLocation': f'https://{host}/{key_file}',
            'urlList': batch,
        }
        subprocess.run([
            'curl', '-sS', '-X', 'POST', 'https://api.indexnow.org/indexnow',
            '-H', 'Content-Type: application/json; charset=utf-8',
            '--data-binary', json.dumps(payload)
        ], check=True)
        print(f'INDEXNOW_OK host={host} mode={mode} urls={len(batch)} key_file={key_file}')
        submitted += len(batch)
if submitted == 0:
    print(f'INDEXNOW_NOOP mode={mode} no matching URLs for configured hosts')
PY
