# Render DB rotation

`render-db-rotate.sh` rotates the **free-tier** Render Postgres before Render's
~30-day deletion, with **no data loss**. It never deletes the old database until
the new one is verified and serving live traffic.

The free tier allows only **one active Postgres per workspace**, so old and new
can't coexist. The script **suspends** the old DB (reversible) to free the slot
rather than deleting it, which means there is a **downtime window** (a few
minutes) between suspend and the new DB going live. On free tier this is
unavoidable; a paid instance removes it.

## Order of operations

1. **dump** the current DB (`pg_dump`, custom format) → timestamped file
   (must run while the old DB is still active)
2. **verify** by restoring the dump into a throwaway local container and
   comparing per-table row counts to the source
3. **suspend** the old DB (`POST /postgres/{id}/suspend`) to free the slot —
   **downtime starts.** Any failure below auto-**resumes** the old DB (rollback)
   so the app recovers on the original data.
4. **create** a new free Postgres with the *same name* (keeps `render.yaml`'s
   `fromDatabase` wiring valid)
5. **restore** the dump into the new DB
6. **verify** new-DB row counts against the source — abort on any drift
7. **repoint** the web service `DATABASE_URL`, redeploy, poll `/ready` until the
   live app reports a healthy DB connection — **downtime ends**
8. **finish** — delete the old DB (default), or keep it suspended (`--keep-old`)

The backup file is always kept (default `~/minhytte-backups/`).

> **Unverified assumption:** that suspending a free DB actually frees the slot to
> create a second one — Render doesn't document this. If `create` fails, the
> script resumes the old DB and aborts (reversible, costing only the downtime).
> The very first real run will confirm or refute it; use `--keep-old` that time.

## Requirements

- **Docker** (uses the `postgres:18` image so the client matches the server)
- **node** (JSON parsing)
- **`RENDER_API_KEY`** env var — a **dedicated, non-expiring** API key from
  Render dashboard → Account Settings → API Keys.
  ⚠️ The CLI token in `~/.render/cli.yaml` expires and will not work from cron.

## Usage

```bash
# 1. First, build trust — dump + local verify only, no changes to Render:
scripts/render-db-rotate.sh --backup-only

# 2. See exactly what a real run would do, no mutations:
scripts/render-db-rotate.sh --dry-run

# 3. Full rotation, prompts before suspend AND before deleting the old DB:
scripts/render-db-rotate.sh

# 4. First real rotation — keep the old DB suspended as a safety net:
scripts/render-db-rotate.sh --keep-old

# 5. Full rotation, no prompts (for cron):
scripts/render-db-rotate.sh --yes
```

If any step fails after suspend, the script **auto-resumes the old DB** and
aborts before deleting anything. The new DB and backup file are left in place
for inspection.

## Caveats

- **Don't push to `master` while a rotation runs.** During the brief window two
  databases share the name `minhytteapp_production`; a blueprint sync mid-window
  could resolve ambiguously. Runs take only a few minutes.
- After deletion the name is unique again, so future blueprint syncs (git push)
  re-resolve `DATABASE_URL` to the new DB automatically — the script's explicit
  override is consistent with that and harmless.
- Config is overridable via env vars (see the top of the script): `RENDER_DB_NAME`,
  `RENDER_SERVICE_ID`, `RENDER_OWNER_ID`, `BACKUP_DIR`, `HEALTH_URL`, etc.

## Scheduling (after you trust it)

The new DB's `expiresAt` is ~30 days out; rotate before then. Options:

- **systemd timer / cron** on an always-on machine, exporting `RENDER_API_KEY`.
- **GitHub Actions** monthly schedule (runner has Docker) with `RENDER_API_KEY`
  as a repo secret — most reliable since it doesn't depend on your laptop.

Ask and I'll wire up whichever you prefer.
