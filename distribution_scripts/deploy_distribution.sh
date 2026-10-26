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
    out.setdefault('namedStops',[]).extend(r.get('namedStops',[]))
    if r.get('status') not in ('success','dry-run','named-stop'):
        out['status']='failed'; out['failures'].extend(r.get('failures',[]))
if out['status']!='failed' and out['namedStops']:
    out['status']='named-stop'
    for s in out['namedStops']: print(f"NAMED STOP: {s['code']} {s['host']} {s['httpStatus']}")
pathlib.Path('reports/indexnow-submit-report.json').write_text(json.dumps(out,indent=2)+'\n')
print('Aggregate IndexNow report written: reports/indexnow-submit-report.json')
if out['status']=='failed': raise SystemExit(1)
PY

echo
 echo "== 3) Optional Google sitemap submit =="
# Submit the index AND every sub-sitemap the build just published, derived from
# the artifact's own sitemap.xml rather than from a hand-kept list.
#
# The defect this fixes (Search Readiness e2, 26 Oct 2026). This line used to
# submit a hard-coded "https://${HOST}/sitemap.xml" and nothing else, so no
# child sitemap was ever resubmitted - Search Console re-read them only on its
# own schedule, and unevenly. hormonesivhair.com/sitemap-core.xml had not been
# re-read since 13 Oct while sitemap-cities/guides/fresh were read 19-22 Oct,
# and it still carried 1 error against the 67-URL version it read that day; the
# live file had moved on to 64 URLs. The error could not clear and the read was
# 13 days stale, against item e2's 14-day window.
#
# distribution.config.json's gsc.sites[].sitemaps named two feeds per host while
# the build emits up to five, and no code read that list at all - so the list
# was a wish and the submit was a guess. The artifact index is the one
# definition: scripts/sitemap_emit.js lists in it exactly the sub-sitemaps it
# wrote and that carry URLs, so submitting its children submits what shipped and
# never a feed that does not exist.
# Guarded by scripts/validation/sitemap_submission_coverage_contract.js.
if [[ -n "$GSC_CREDS" && -n "$GSC_SITE_URL" && -f "$GSC_CREDS" ]]; then
  SITEMAP_FEEDS=()
  while IFS= read -r feed; do
    [[ -n "$feed" ]] && SITEMAP_FEEDS+=("$feed")
  done < <(python3 - "$ARTIFACT_DIR" "$HOST" <<'PY'
import pathlib, re, sys
artifact_dir, host = sys.argv[1], sys.argv[2]
index = pathlib.Path(artifact_dir) / 'sitemap.xml'
feeds = [f'https://{host}/sitemap.xml']
if index.is_file():
    for loc in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', index.read_text(encoding='utf-8')):
        if loc not in feeds:
            feeds.append(loc)
for f in feeds:
    print(f)
PY
)
  if [[ "${#SITEMAP_FEEDS[@]}" -eq 0 ]]; then
    echo "ERROR: no sitemap feeds derived from ${ARTIFACT_DIR}/sitemap.xml" >&2
    exit 1
  fi
  echo "Submitting ${#SITEMAP_FEEDS[@]} sitemap feed(s): ${SITEMAP_FEEDS[*]}"
  python3 distribution_scripts/gsc_submit_sitemaps.py "$GSC_CREDS" "$GSC_SITE_URL" "${SITEMAP_FEEDS[@]}" || echo "WARNING: GSC sitemap submit failed; IndexNow already completed."
else
  echo "SKIP: GSC credentials/site not supplied."
fi

echo
 echo "== 4) Optional GSC priority URL inspection =="
if [[ -n "$GSC_CREDS" && -n "$GSC_SITE_URL" && -f "$GSC_CREDS" ]]; then
  # No `|| echo WARNING` here any more. That masked a real defect: the inspector
  # crashed on the first HTTP 429 and this line turned the crash into a warning,
  # so URL inspection failed silently on every run while the job reported success.
  #
  # The inspector now exits 0 when it stops on quota (an expected operating
  # condition -- 2,000/day per property) and non-zero only for a genuine fault,
  # so a non-zero exit here is worth failing on.
  if python3 distribution_scripts/gsc_inspect_urls.py "$GSC_CREDS" "$GSC_SITE_URL" "$PRIORITY_FILE" "reports/gsc-inspection-results.json"; then
    :
  else
    echo "ERROR: GSC URL inspection failed for a reason other than quota. See reports/gsc-inspection-results.json for stopped_reason."
    exit 1
  fi
else
  echo "SKIP: GSC credentials/site not supplied."
fi

echo "Done."
