# CI — GitHub Actions test workflow

How `.github/workflows/test.yml` works, in plain terms.

## What it is

A YAML recipe that GitHub watches. When certain things happen in the repo,
GitHub spins up a fresh Linux machine, runs the steps listed in the file, and
reports the result as a green check or red X next to the commit/PR.

You don't run it. GitHub runs it for you, on their hardware, for free
(within generous limits for public repos and the included quota for private
ones).

## When it runs (triggers)

- **Push to `master`** — unless the only changes are `*.md` or `plans/**`.
- **Open a pull request** (any branch into any branch).
- **Push a new commit to a branch with an open PR** — re-runs on the update.

Doc-only changes skip CI thanks to `paths-ignore`.

## What happens when it runs

1. **GitHub allocates a runner.** An empty Ubuntu VM (~2 vCPU / 7 GB RAM),
   fresh every time. No state from previous runs.
2. **Concurrency guard.** If you push twice in quick succession to the same
   ref, the older run is cancelled. Prevents two PR runs racing on the same
   commit and saves minutes.
3. **Token issued with read-only permissions.** Because of
   `permissions: contents: read`, the runner gets a one-shot token that can
   only read the repo. It cannot push, comment, or modify anything — even if
   a malicious dependency tried.
4. **`actions/checkout@v4`** — git-clones the repo at the commit being
   tested into the runner.
5. **`pnpm/action-setup@v4`** — installs pnpm. No `version:` is specified,
   so it reads `"packageManager": "pnpm@10.30.0"` from `package.json` and
   installs exactly that version. Bumping that field in `package.json` is
   how you bump pnpm in CI.
6. **`actions/setup-node@v4`** — installs Node.js 24 and wires up the pnpm
   cache. The `cache: pnpm` flag means: before `pnpm install` runs, restore
   the pnpm store from a previous run if `pnpm-lock.yaml` hasn't changed;
   after the job, save the store back. This is why subsequent runs are
   much faster than the first.
7. **`pnpm install --frozen-lockfile`** — installs dependencies. The
   `--frozen-lockfile` flag fails immediately if `pnpm-lock.yaml` doesn't
   match `package.json`. Catches anyone who updated `package.json` but
   forgot to commit the lockfile.
8. **`pnpm test`** — runs vitest's 405-test suite. Hermetic: no DB, no
   server, no network. If any test fails, the step fails, which fails the
   job, which fails the workflow.
9. **GitHub reports the result** — green check or red X next to the commit.
10. **Timeout safety net.** If the whole job hasn't finished in 10 minutes
    (`timeout-minutes: 10`), GitHub kills it. The suite normally runs in
    ~90 seconds, so this only triggers on a genuine hang.

## What you'll see, procedurally

**When you push to a PR branch:**

1. Push to your branch (`git push`).
2. GitHub immediately shows a yellow dot next to your commit on the PR
   page — "queued."
3. ~10 seconds later, the dot becomes a spinning yellow circle —
   "running."
4. Click the circle → "Details" — live logs stream as each step runs.
5. ~2 minutes later cold, ~90 seconds with a warm cache, the circle becomes
   a green check or red X.
6. If red, "Details" shows exactly which test failed with the assertion
   output.

**When CI fails and you push again:**

1. The previous yellow run, if still running, is cancelled by the
   concurrency block.
2. A new run starts on the new commit.
3. Lockfile unchanged → pnpm store restored from cache → install
   finishes in seconds.
4. Same flow as above.

## Turning the green check into a merge gate

The workflow itself just reports pass/fail. To block merging on a red CI,
add a **branch protection rule** in GitHub:

1. Repo → **Settings** → **Branches** → **Add branch protection rule**.
2. Branch name pattern: `master`.
3. Check **Require status checks to pass before merging**.
4. In the search box, type `test` (the workflow name) and select it.
5. Save.

Now PRs to `master` cannot be merged until the `test` check is green.
Without this rule, CI is informational only — it'll still report, but
nothing prevents a merge with a red X.

## Mental model

The workflow is a recipe GitHub follows every time you push:

> "Take a fresh empty Ubuntu machine. Clone the repo. Install pnpm
> 10.30.0. Install Node 24. Restore the dependency cache if you have one.
> Run `pnpm install` strictly against the lockfile. Run `pnpm test`. Tell
> me if any step exited non-zero."

Everything in `.github/workflows/test.yml` is just that recipe in a format
GitHub can execute.

## What's deliberately not in this workflow

- **`pnpm type-check`** — currently has a pre-existing TypeScript error in
  `client/src/routes/_authed/manageproperty/-priority/PriorityWeeks.tsx`.
  Fix that, then append `- run: pnpm type-check` after the test step.
- **`pnpm lint`** — currently 458 ESLint errors across the repo. Run
  `pnpm lint:fix` for auto-fixes, then triage the rest before adding to CI.
- **`pnpm format:check`** — same reasoning; run `pnpm format` once across
  the repo, then add.
- **`pnpm build`** — depends on `tsc -b` (type-check), so blocked on the
  same fix.
- **`pnpm test:e2e`** — needs a live server + Postgres. Add as a separate
  job with a `services: postgres:` block when ready.
