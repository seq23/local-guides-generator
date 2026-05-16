#!/usr/bin/env bash
set -euo pipefail

HOST=""
KEY=""
URL_FILE=""
ALLOW_MIXED="0"
DRY_RUN="0"
REPORT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="${2:?}"; shift 2 ;;
    --key) KEY="${2:?}"; shift 2 ;;
    --file) URL_FILE="${2:?}"; shift 2 ;;
    --allow-mixed) ALLOW_MIXED="1"; shift 1 ;;
    --dry-run) DRY_RUN="1"; shift 1 ;;
    --report) REPORT_FILE="${2:?}"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$URL_FILE" ]] || { echo "ERROR: --file is required" >&2; exit 1; }
[[ -f "$URL_FILE" ]] || { echo "ERROR: URL file not found: $URL_FILE" >&2; exit 1; }
mkdir -p reports
if [[ -z "$REPORT_FILE" ]]; then
  base="$(basename "$URL_FILE" .txt)"
  REPORT_FILE="reports/${base}-submit-report.json"
fi

if [[ -z "$KEY" ]]; then
  keyfile="$(find . -maxdepth 1 -type f -name "*.txt" | grep -E './[0-9a-fA-F-]{32,64}\.txt$' | head -1 || true)"
  if [[ -n "$keyfile" ]]; then KEY="$(basename "$keyfile" .txt)"; fi
fi

python3 - <<'PY' "$URL_FILE" "$HOST" "$KEY" "$ALLOW_MIXED" "$DRY_RUN" "$REPORT_FILE"
import json, pathlib, sys, urllib.parse, urllib.request, datetime, os
url_file = pathlib.Path(sys.argv[1])
forced_host = sys.argv[2].strip()
key = sys.argv[3].strip()
allow_mixed = sys.argv[4] == '1'
dry_run = sys.argv[5] == '1'
report_file = pathlib.Path(sys.argv[6])
urls=[]
for raw in url_file.read_text(encoding='utf-8').splitlines():
    line=raw.strip().replace('<loc>','').replace('</loc>','').strip()
    if not line: continue
    p=urllib.parse.urlparse(line)
    if p.scheme not in ('http','https') or not p.netloc:
        raise SystemExit(f'ERROR: invalid URL in file: {line}')
    urls.append(line)
if not urls:
    raise SystemExit('ERROR: no URLs found to submit')
by_host={}
for u in urls:
    by_host.setdefault(urllib.parse.urlparse(u).netloc, []).append(u)
if forced_host:
    bad=[h for h in by_host if h != forced_host]
    if bad and not allow_mixed:
        raise SystemExit(f"ERROR: file contains mixed hosts ({', '.join(sorted(by_host))}); rerun with --allow-mixed")
else:
    if len(by_host)>1 and not allow_mixed:
        raise SystemExit(f"ERROR: file contains mixed hosts ({', '.join(sorted(by_host))}); rerun with --allow-mixed")
    forced_host=sorted(by_host)[0]
report={'submittedAt':datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z'),'sourceFile':str(url_file),'dryRun':dry_run,'status':'dry-run' if dry_run else 'success','totalUrlCount':len(urls),'hosts':{},'failures':[]}

def verify_key(host):
    if not key:
        if dry_run: return True
        report['failures'].append({'host':host,'error':'missing INDEXNOW key'})
        return False
    key_path=pathlib.Path(f'{key}.txt')
    alt_path=pathlib.Path('indexnow.txt')
    if key_path.exists() and key_path.read_text(encoding='utf-8').strip()==key: return True
    if alt_path.exists() and alt_path.read_text(encoding='utf-8').strip()==key: return True
    if dry_run: return True
    report['failures'].append({'host':host,'error':f'public key file missing or mismatch for key {key}'})
    return False

def submit(host, host_urls):
    report['hosts'][host]={'urlCount':len(host_urls),'status':'dry-run' if dry_run else 'pending','keyLocation':f'https://{host}/{key}.txt' if key else ''}
    if dry_run:
        return
    if not verify_key(host):
        report['hosts'][host]['status']='failed'
        return
    payload={'host':host,'key':key,'keyLocation':f'https://{host}/{key}.txt','urlList':host_urls}
    body=json.dumps(payload).encode('utf-8')
    req=urllib.request.Request('https://api.indexnow.org/indexnow',data=body,headers={'Content-Type':'application/json; charset=utf-8'},method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text=resp.read().decode('utf-8',errors='replace')
            report['hosts'][host]['status']='success'
            report['hosts'][host]['httpStatus']=resp.status
            if text.strip(): report['hosts'][host]['body']=text[:1000]
            print(f'IndexNow submit OK: host={host} count={len(host_urls)} status={resp.status}')
    except Exception as exc:
        report['hosts'][host]['status']='failed'
        report['failures'].append({'host':host,'error':str(exc)})

if allow_mixed and len(by_host)>1:
    for host in sorted(by_host): submit(host, by_host[host])
else:
    submit(forced_host, urls)
if report['failures']:
    report['status']='failed'
report_file.parent.mkdir(parents=True, exist_ok=True)
report_file.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(f'IndexNow report written: {report_file}')
if report['status']=='failed' and not dry_run:
    raise SystemExit(1)
PY
