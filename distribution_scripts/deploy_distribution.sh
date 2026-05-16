#!/usr/bin/env bash
set -euo pipefail
HOST=""
KEY="${INDEXNOW_KEY:-}"
ARTIFACT_DIR=""
GSC_CREDS=""
GSC_SITE_URL="${GSC_SITE_URL:-}"
ALLOW_MIXED="0"
DRY_RUN="0"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="${2:?}"; shift 2 ;;
    --key) KEY="${2:?}"; shift 2 ;;
    --artifact-dir) ARTIFACT_DIR="${2:?}"; shift 2 ;;
    --creds) GSC_CREDS="${2:?}"; shift 2 ;;
    --gsc-site) GSC_SITE_URL="${2:?}"; shift 2 ;;
    --allow-mixed) ALLOW_MIXED="1"; shift 1 ;;
    --dry-run) DRY_RUN="1"; shift 1 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done
if [[ -z "$ARTIFACT_DIR" ]]; then
  if [[ -f ".build/indexnow-priority.txt" && -f ".build/indexnow-batch.txt" ]]; then ARTIFACT_DIR=".build";
  elif [[ -f "dist/indexnow-priority.txt" && -f "dist/indexnow-batch.txt" ]]; then ARTIFACT_DIR="dist";
  else echo "ERROR: could not detect artifact dir (.build or dist)" >&2; exit 1; fi
fi
PRIORITY_FILE="${ARTIFACT_DIR}/indexnow-priority.txt"
BATCH_FILE="${ARTIFACT_DIR}/indexnow-batch.txt"
[[ -f "$PRIORITY_FILE" ]] || { echo "ERROR: missing $PRIORITY_FILE" >&2; exit 1; }
[[ -f "$BATCH_FILE" ]] || { echo "ERROR: missing $BATCH_FILE" >&2; exit 1; }
mkdir -p reports
if [[ -z "$HOST" ]]; then
  HOST="$(python3 - <<'PY' "$PRIORITY_FILE"
import sys, urllib.parse, pathlib
hosts=sorted({urllib.parse.urlparse(l.strip().replace('<loc>','').replace('</loc>','')).netloc for l in pathlib.Path(sys.argv[1]).read_text().splitlines() if l.strip() and urllib.parse.urlparse(l.strip().replace('<loc>','').replace('</loc>','')).netloc})
print(hosts[0] if hosts else '')
PY
)"
fi
[[ -n "$HOST" ]] || { echo "ERROR: could not detect host" >&2; exit 1; }
echo "== Distribution config =="
echo "HOST=$HOST"
echo "ARTIFACT_DIR=$ARTIFACT_DIR"
echo "PRIORITY_FILE=$PRIORITY_FILE"
echo "BATCH_FILE=$BATCH_FILE"
echo "DRY_RUN=$DRY_RUN"
echo

echo "== 1) Submit IndexNow priority URLs =="
ARGS=(--host "$HOST" --file "$PRIORITY_FILE" --report reports/indexnow-priority-submit-report.json)
[[ -n "$KEY" ]] && ARGS+=(--key "$KEY")
[[ "$ALLOW_MIXED" == "1" ]] && ARGS+=(--allow-mixed)
[[ "$DRY_RUN" == "1" || -z "$KEY" ]] && ARGS+=(--dry-run)
distribution_scripts/indexnow_submit.sh "${ARGS[@]}"

echo
 echo "== 2) Submit IndexNow batch URLs =="
ARGS=(--host "$HOST" --file "$BATCH_FILE" --report reports/indexnow-batch-submit-report.json)
[[ -n "$KEY" ]] && ARGS+=(--key "$KEY")
[[ "$ALLOW_MIXED" == "1" ]] && ARGS+=(--allow-mixed)
[[ "$DRY_RUN" == "1" || -z "$KEY" ]] && ARGS+=(--dry-run)
distribution_scripts/indexnow_submit.sh "${ARGS[@]}"

python3 - <<'PY'
import json, pathlib, datetime
reports=[]
for f in ['reports/indexnow-priority-submit-report.json','reports/indexnow-batch-submit-report.json']:
    p=pathlib.Path(f)
    reports.append(json.loads(p.read_text()) if p.exists() else {'status':'missing','sourceFile':f})
out={'submittedAt':datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z'),'status':'success','reports':reports,'failures':[]}
for r in reports:
    if r.get('status') not in ('success','dry-run'):
        out['status']='failed'; out['failures'].extend(r.get('failures',[]))
pathlib.Path('reports/indexnow-submit-report.json').write_text(json.dumps(out,indent=2)+'\n')
print('Aggregate IndexNow report written: reports/indexnow-submit-report.json')
if out['status']=='failed': raise SystemExit(1)
PY

echo
 echo "== 3) Optional Google sitemap submit =="
if [[ -n "$GSC_CREDS" && -n "$GSC_SITE_URL" && -f "$GSC_CREDS" ]]; then
  python3 distribution_scripts/gsc_submit_sitemaps.py "$GSC_CREDS" "$GSC_SITE_URL" "https://${HOST}/sitemap.xml" || echo "WARNING: GSC sitemap submit failed; IndexNow already completed."
else
  echo "SKIP: GSC credentials/site not supplied."
fi

echo
 echo "== 4) Optional GSC priority URL inspection =="
if [[ -n "$GSC_CREDS" && -n "$GSC_SITE_URL" && -f "$GSC_CREDS" ]]; then
  python3 distribution_scripts/gsc_inspect_urls.py "$GSC_CREDS" "$GSC_SITE_URL" "$PRIORITY_FILE" "reports/gsc-inspection-results.json" || echo "WARNING: GSC inspection failed; non-blocking."
else
  echo "SKIP: GSC credentials/site not supplied."
fi

echo "Done."
