#!/usr/bin/env bash
#
# render-db-rotate.sh — safe monthly rotation of the free-tier Render Postgres.
#
# Render deletes free Postgres instances ~30 days after creation, and the free
# tier allows only ONE active Postgres per workspace — so old and new can't run
# side by side. Instead we SUSPEND the old DB (reversible) to free the slot, and
# never DELETE it until the new one is verified and serving live traffic:
#
#   1. dump      : pg_dump the current DB (custom format) to a timestamped file
#                  (must run while the old DB is still active)
#   2. verify    : restore the dump into a throwaway local container and
#                  compare per-table row counts against the source — proves the
#                  dump is complete and restorable BEFORE we touch anything
#   3. suspend   : POST /postgres/{id}/suspend on the old DB to free the slot.
#                  *** APP DOWNTIME STARTS HERE *** — the only DB is offline
#                  until step 7. Any failure below AUTO-RESUMES the old DB
#                  (rollback) so the app recovers on the original data.
#   4. create    : create a new free Postgres with the SAME name (keeps the
#                  render.yaml `fromDatabase` wiring valid long-term)
#   5. restore   : restore the dump into the new DB
#   6. verify    : compare per-table row counts new-DB vs source — abort on drift
#   7. repoint   : set the web service DATABASE_URL to the new DB, redeploy,
#                  poll /ready until the app reports a healthy DB connection
#                  — DOWNTIME ENDS HERE
#   8. finish    : delete the old DB (default), or keep it suspended (--keep-old)
#
# UNVERIFIED ASSUMPTION: that suspending a free DB frees the slot to create a
# second one (Render doesn't document this). If create (step 4) fails, the old
# DB is auto-resumed and the script aborts — reversible, costing only downtime.
#
# The backup file is always kept regardless of outcome.
#
# Tooling: uses the official `postgres:18` Docker image for pg_dump/pg_restore/
# psql so the client version matches the server (v18). No local psql needed.
#
# Auth: reads RENDER_API_KEY from the environment. For unattended/cron runs use
# a DEDICATED non-expiring API key (Render dashboard → Account Settings → API
# Keys). For manual runs it falls back to the short-lived CLI token in
# ~/.render/cli.yaml, which expires and will NOT work from cron.
#
# Usage:
#   scripts/render-db-rotate.sh --backup-only     # dump + verify only (start here)
#   scripts/render-db-rotate.sh --dry-run         # show what it would do
#   scripts/render-db-rotate.sh                   # full rotation (asks before delete)
#   scripts/render-db-rotate.sh --yes             # full rotation, no prompt (cron)
#   scripts/render-db-rotate.sh --keep-old        # rotate but leave old DB suspended
#
set -euo pipefail

# ----------------------------------------------------------------------------
# Config (override via environment)
# ----------------------------------------------------------------------------
API="${RENDER_API_BASE:-https://api.render.com/v1}"
OWNER_ID="${RENDER_OWNER_ID:-tea-d7v2iehj2pic73epd47g}"   # hytteworkspace
SERVICE_ID="${RENDER_SERVICE_ID:-srv-d8apcv6gvqtc73d34h9g}"  # minhytteapp web
DB_NAME="${RENDER_DB_NAME:-minhytteapp_production}"
DB_USER="${RENDER_DB_USER:-nielsgt}"
REGION="${RENDER_REGION:-frankfurt}"
PLAN="${RENDER_DB_PLAN:-free}"
PG_VERSION="${RENDER_PG_VERSION:-18}"
PG_IMAGE="${PG_IMAGE:-postgres:18}"
HEALTH_URL="${HEALTH_URL:-https://minhytte.app/ready}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/minhytte-backups}"

# ----------------------------------------------------------------------------
# Flags
# ----------------------------------------------------------------------------
BACKUP_ONLY=false
DRY_RUN=false
ASSUME_YES=false
KEEP_OLD=false
SKIP_LOCAL_VERIFY=false
for arg in "$@"; do
  case "$arg" in
    --backup-only) BACKUP_ONLY=true ;;
    --dry-run)     DRY_RUN=true ;;
    --yes|-y)      ASSUME_YES=true ;;
    --keep-old)    KEEP_OLD=true ;;
    --skip-local-verify) SKIP_LOCAL_VERIFY=true ;;
    -h|--help)     sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
ts()  { date +'%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }
die() { echo "[$(ts)] ERROR: $*" >&2; exit 1; }

# Parse a dotted path out of JSON on stdin, e.g.  echo "$resp" | jget id
jget() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{let o;try{o=JSON.parse(d)}catch(e){process.exit(0)}for(const k of (process.argv[1]||"").split(".").filter(Boolean)){o=o==null?null:o[k]}process.stdout.write(o==null?"":(typeof o==="object"?JSON.stringify(o):String(o)))})' "$1"
}

api() { # api METHOD PATH [json-body]
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d "$body" "$API$path"
  else
    curl -sS -X "$method" -H "Authorization: Bearer $TOKEN" "$API$path"
  fi
}

confirm() {
  $ASSUME_YES && return 0
  read -r -p "$1 [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}

# Run pg client tools from the postgres:18 image. Backup dir mounted at /backup.
# Run as the host user so dump files are user-owned (clean cron retention).
pg_tool() { # pg_tool <pg_dump|pg_restore|psql> args...
  docker run --rm --user "$(id -u):$(id -g)" -v "$BACKUP_DIR:/backup" "$PG_IMAGE" "$@"
}

# Per-table row-count fingerprint of a database, sorted "table,count" lines.
counts_for() { # counts_for <connection-url>
  local url="$1"
  local q
  q=$(pg_tool psql "$url" -At -c \
    "SELECT coalesce(string_agg(format('SELECT %L AS t, count(*) AS c FROM %I.%I', tablename, schemaname, tablename), ' UNION ALL '), 'SELECT NULL t, 0 c WHERE false') FROM pg_tables WHERE schemaname='public'")
  [[ -z "$q" ]] && return 0
  pg_tool psql "$url" -At -F',' -c "SELECT t, c FROM ($q) s ORDER BY t"
}

# ----------------------------------------------------------------------------
# Resolve auth token
# ----------------------------------------------------------------------------
TOKEN="${RENDER_API_KEY:-}"
if [[ -z "$TOKEN" ]]; then
  if [[ -f "$HOME/.render/cli.yaml" ]]; then
    TOKEN=$(awk '/^api:/{f=1} f&&/key:/{print $2; exit}' "$HOME/.render/cli.yaml" | tr -d '"')
    log "WARN: using CLI token from ~/.render/cli.yaml (expires; not for cron)."
  fi
fi
[[ -n "$TOKEN" ]] || die "No API token. Set RENDER_API_KEY (dedicated key for cron)."

# ----------------------------------------------------------------------------
# Preflight
# ----------------------------------------------------------------------------
command -v docker >/dev/null || die "docker not found."
command -v node   >/dev/null || die "node not found."
docker info >/dev/null 2>&1  || die "docker daemon not usable."
mkdir -p "$BACKUP_DIR"

log "Pulling $PG_IMAGE if needed..."
$DRY_RUN || docker image inspect "$PG_IMAGE" >/dev/null 2>&1 || docker pull "$PG_IMAGE" >/dev/null

# Find the CURRENT db by name+owner (its id changes every rotation).
log "Locating current database '$DB_NAME' in owner $OWNER_ID..."
LIST=$(api GET "/postgres?ownerId=$OWNER_ID&limit=100")
OLD_ID=$(echo "$LIST" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);const m=a.map(x=>x.postgres).filter(p=>p&&p.name===process.argv[1]).sort((x,y)=>String(x.createdAt).localeCompare(String(y.createdAt)));process.stdout.write(m.length?m[m.length-1].id:"")})' "$DB_NAME")
[[ -n "$OLD_ID" ]] || die "Could not find a Postgres named '$DB_NAME'."
OLD_INFO=$(api GET "/postgres/$OLD_ID")
OLD_EXPIRES=$(echo "$OLD_INFO" | jget expiresAt)
OLD_STATUS=$(echo "$OLD_INFO" | jget status)
log "Current DB: $OLD_ID  status=$OLD_STATUS  expiresAt=${OLD_EXPIRES:-none}"
[[ "$OLD_STATUS" == "available" ]] || die "Current DB not 'available' (got '$OLD_STATUS'). Aborting."

OLD_EXT=$(api GET "/postgres/$OLD_ID/connection-info" | jget externalConnectionString)
[[ -n "$OLD_EXT" ]] || die "No external connection string for old DB."
OLD_URL="${OLD_EXT}?sslmode=require"

# ----------------------------------------------------------------------------
# 1. Dump
# ----------------------------------------------------------------------------
STAMP=$(date +'%Y-%m-%d_%H%M%S')
DUMP_FILE="${DB_NAME}_${STAMP}.dump"
DUMP_PATH="$BACKUP_DIR/$DUMP_FILE"

if $DRY_RUN; then
  log "[dry-run] would pg_dump $OLD_ID -> $DUMP_PATH"
else
  log "Dumping $OLD_ID -> $DUMP_PATH"
  pg_tool pg_dump --format=custom --no-owner --no-privileges --verbose \
    --file="/backup/$DUMP_FILE" "$OLD_URL" 2> >(grep -i -E 'error|fatal' >&2 || true)
  SIZE=$(stat -c%s "$DUMP_PATH" 2>/dev/null || echo 0)
  log "Dump complete: $SIZE bytes"
  [[ "$SIZE" -gt 1024 ]] || die "Dump suspiciously small ($SIZE bytes). Aborting."
  log "Dump TOC entries: $(pg_tool pg_restore --list "/backup/$DUMP_FILE" | grep -c ';' || true)"
fi

# Source fingerprint for verification.
if ! $DRY_RUN; then
  log "Capturing source row counts..."
  SRC_COUNTS=$(counts_for "$OLD_URL")
  echo "$SRC_COUNTS" > "$BACKUP_DIR/${DB_NAME}_${STAMP}.counts.txt"
  log "Source has $(echo "$SRC_COUNTS" | grep -c . || true) public tables."
fi

# ----------------------------------------------------------------------------
# 2. Verify dump locally (restore into a throwaway container)
# ----------------------------------------------------------------------------
if $SKIP_LOCAL_VERIFY; then
  log "Skipping local verify-restore (--skip-local-verify)."
elif $DRY_RUN; then
  log "[dry-run] would restore dump into a throwaway postgres:18 container and diff counts"
else
  VERIFY_CT="minhytte-verify-$STAMP"
  log "Verifying dump in throwaway container $VERIFY_CT..."
  docker run -d --name "$VERIFY_CT" -e POSTGRES_PASSWORD=verify \
    -v "$BACKUP_DIR:/backup:ro" "$PG_IMAGE" >/dev/null
  cleanup_verify() { docker rm -f "$VERIFY_CT" >/dev/null 2>&1 || true; }
  trap cleanup_verify EXIT
  for i in $(seq 1 30); do
    docker exec "$VERIFY_CT" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
    [[ $i -eq 30 ]] && die "Verify container never became ready."
  done
  docker exec -e PGPASSWORD=verify "$VERIFY_CT" \
    pg_restore --no-owner --no-privileges -d "postgresql://postgres@localhost/postgres" \
    "/backup/$DUMP_FILE" 2> >(grep -i -E 'error|fatal' >&2 || true) || \
    log "WARN: pg_restore reported non-zero (often harmless for comments/extensions); diffing counts to decide."
  VER_COUNTS=$(docker exec -e PGPASSWORD=verify "$VERIFY_CT" \
    psql "postgresql://postgres@localhost/postgres" -At -c \
    "SELECT t, c FROM (SELECT (string_agg(format('SELECT %L AS t, count(*) AS c FROM %I.%I', tablename, schemaname, tablename), ' UNION ALL ')) q FROM pg_tables WHERE schemaname='public') x, LATERAL (SELECT 1) y" 2>/dev/null) || true
  # Re-run counts cleanly via the same helper logic inside the container:
  VER_COUNTS=$(docker exec -e PGPASSWORD=verify "$VERIFY_CT" bash -lc '
    q=$(psql "postgresql://postgres@localhost/postgres" -At -c "SELECT string_agg(format('"'"'SELECT %L AS t, count(*) AS c FROM %I.%I'"'"', tablename, schemaname, tablename), '"'"' UNION ALL '"'"') FROM pg_tables WHERE schemaname='"'"'public'"'"'")
    [ -z "$q" ] && exit 0
    psql "postgresql://postgres@localhost/postgres" -At -F"," -c "SELECT t,c FROM ($q) s ORDER BY t"')
  if [[ "$VER_COUNTS" != "$SRC_COUNTS" ]]; then
    echo "--- source ---"; echo "$SRC_COUNTS"
    echo "--- restored ---"; echo "$VER_COUNTS"
    die "Local verify FAILED: row counts differ between source and restored dump."
  fi
  log "Local verify OK: restored dump matches source row counts."
  cleanup_verify; trap - EXIT
fi

if $BACKUP_ONLY; then
  log "Backup-only mode done. Backup at: $DUMP_PATH"
  exit 0
fi
$DRY_RUN && { log "[dry-run] stopping before any mutation."; exit 0; }

# ----------------------------------------------------------------------------
# 3. Suspend old DB to free the free-tier slot (DOWNTIME STARTS).
#    From here on, any non-zero exit auto-resumes the old DB (rollback) unless
#    we've already gone live on the new DB (ROTATION_DONE=true).
# ----------------------------------------------------------------------------
OLD_SUSPENDED=false
ROTATION_DONE=false
rollback() {
  local code=$?
  if [[ "$code" -ne 0 && "$OLD_SUSPENDED" == true && "$ROTATION_DONE" != true ]]; then
    log "FAILURE after suspend — resuming OLD DB $OLD_ID to restore the app..."
    api POST "/postgres/$OLD_ID/resume" >/dev/null 2>&1 \
      && log "Resume requested for $OLD_ID. Confirm the app recovers at $HEALTH_URL." \
      || log "WARN: resume call FAILED. Resume $OLD_ID MANUALLY in the dashboard NOW."
  fi
}
trap rollback EXIT

confirm "Suspend old DB $OLD_ID now? This starts app DOWNTIME until the new DB is live." \
  || die "Aborted before suspend; nothing changed."
log "Suspending old DB $OLD_ID..."
api POST "/postgres/$OLD_ID/suspend" >/dev/null
OLD_SUSPENDED=true
for i in $(seq 1 30); do
  st=$(api GET "/postgres/$OLD_ID" | jget status)
  [[ "$st" == "suspended" ]] && { log "Old DB suspended."; break; }
  sleep 3
  [[ $i -eq 30 ]] && die "Old DB did not reach 'suspended' (status=$st)."
done

# ----------------------------------------------------------------------------
# 4. Create new DB (same name keeps render.yaml fromDatabase wiring valid)
# ----------------------------------------------------------------------------
log "Creating new Postgres '$DB_NAME' ($PLAN, $REGION, v$PG_VERSION)..."
CREATE_BODY=$(node -e 'console.log(JSON.stringify({name:process.argv[1],ownerId:process.argv[2],plan:process.argv[3],region:process.argv[4],version:process.argv[5],databaseName:process.argv[1],databaseUser:process.argv[6]}))' \
  "$DB_NAME" "$OWNER_ID" "$PLAN" "$REGION" "$PG_VERSION" "$DB_USER")
CREATE_RESP=$(api POST "/postgres" "$CREATE_BODY")
NEW_ID=$(echo "$CREATE_RESP" | jget id)
# If this fails, suspending the old DB did NOT free the free-tier slot — the
# rollback trap resumes the old DB and the app recovers on original data.
[[ -n "$NEW_ID" && "$NEW_ID" != "$OLD_ID" ]] || die "DB create failed (slot not freed by suspend?): $CREATE_RESP"
log "New DB id: $NEW_ID — waiting until available..."
for i in $(seq 1 60); do
  st=$(api GET "/postgres/$NEW_ID" | jget status)
  [[ "$st" == "available" ]] && { log "New DB available."; break; }
  [[ "$st" == "unavailable" || "$st" == "creation_failed" ]] && die "New DB entered '$st'."
  sleep 5
  [[ $i -eq 60 ]] && die "New DB not available after 5 minutes (status=$st)."
done

NEW_CINFO=$(api GET "/postgres/$NEW_ID/connection-info")
NEW_EXT=$(echo "$NEW_CINFO" | jget externalConnectionString)
NEW_INT=$(echo "$NEW_CINFO" | jget internalConnectionString)
[[ -n "$NEW_EXT" && -n "$NEW_INT" ]] || die "Missing connection strings for new DB."
NEW_URL="${NEW_EXT}?sslmode=require"

# ----------------------------------------------------------------------------
# 5. Restore into new DB
# ----------------------------------------------------------------------------
log "Restoring dump into new DB $NEW_ID..."
pg_tool pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "$NEW_URL" "/backup/$DUMP_FILE" 2> >(grep -i -E 'error|fatal' >&2 || true) || \
  log "WARN: pg_restore non-zero (often harmless); verifying row counts next."

# ----------------------------------------------------------------------------
# 6. Verify restore against source fingerprint
# ----------------------------------------------------------------------------
log "Verifying new DB row counts against source..."
NEW_COUNTS=$(counts_for "$NEW_URL")
if [[ "$NEW_COUNTS" != "$SRC_COUNTS" ]]; then
  echo "--- source ---"; echo "$SRC_COUNTS"
  echo "--- new DB ---"; echo "$NEW_COUNTS"
  die "Restore verify FAILED. New DB $NEW_ID kept for inspection; old DB auto-resumed."
fi
log "Restore verify OK: new DB matches source."

# ----------------------------------------------------------------------------
# 7. Repoint service + redeploy + health check (DOWNTIME ENDS on success)
# ----------------------------------------------------------------------------
log "Pointing service $SERVICE_ID DATABASE_URL at new DB (internal)..."
api PUT "/services/$SERVICE_ID/env-vars/DATABASE_URL" \
  "$(node -e 'console.log(JSON.stringify({value:process.argv[1]}))' "$NEW_INT")" >/dev/null
log "Triggering deploy..."
DEPLOY_ID=$(api POST "/services/$SERVICE_ID/deploys" '{"clearCache":"do_not_clear"}' | jget id)
log "Deploy $DEPLOY_ID started — waiting for live..."
for i in $(seq 1 60); do
  ds=$(api GET "/services/$SERVICE_ID/deploys/$DEPLOY_ID" | jget status)
  case "$ds" in
    live) log "Deploy live."; break ;;
    build_failed|update_failed|canceled|deactivated|pre_deploy_failed)
      die "Deploy $ds. New DB kept; old DB auto-resumed. Inspect before retrying." ;;
  esac
  sleep 5
  [[ $i -eq 60 ]] && die "Deploy not live after 5 min (status=$ds). Old DB auto-resumed."
done

log "Polling $HEALTH_URL for healthy DB connection..."
HEALTHY=false
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo 000)
  [[ "$code" == "200" ]] && { HEALTHY=true; log "App /ready = 200 (DB OK)."; break; }
  sleep 4
done
$HEALTHY || die "App did not report healthy. New DB kept; old DB auto-resumed. Investigate."

# Live on the new DB. From here, do NOT auto-resume the old one on failure.
ROTATION_DONE=true

# ----------------------------------------------------------------------------
# 8. Finish: delete old DB (default) or keep it suspended (--keep-old)
# ----------------------------------------------------------------------------
if $KEEP_OLD; then
  log "--keep-old: leaving old DB $OLD_ID SUSPENDED as a fallback."
  log "WARN: two DBs now share the name '$DB_NAME'. Delete the old one BEFORE the"
  log "      next push to master, or the blueprint's fromDatabase wiring is ambiguous."
else
  [[ "$OLD_ID" != "$NEW_ID" ]] || die "Refusing to delete: old==new id."
  if confirm "Verified & live on new DB $NEW_ID. Delete OLD (suspended) DB $OLD_ID?"; then
    api DELETE "/postgres/$OLD_ID" >/dev/null
    log "Old DB $OLD_ID deleted."
  else
    log "Skipped deleting old DB $OLD_ID (it stays SUSPENDED; delete it before next push to master)."
  fi
fi

log "DONE. Old=$OLD_ID  New=$NEW_ID  Backup=$DUMP_PATH"
NEW_EXPIRES=$(api GET "/postgres/$NEW_ID" | jget expiresAt)
log "New DB expiresAt: ${NEW_EXPIRES:-none} — schedule the next rotation before then."
