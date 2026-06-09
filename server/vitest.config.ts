import { defineConfig } from "vitest/config"

// Server-side integration tests. They talk to a real Postgres (the docker
// compose DB on :5432) but wrap every test in a transaction that is rolled
// back, so the dev database is never mutated. Run with `pnpm test:server`.
//
// Not part of the hermetic `pnpm test` suite (that one is client-only and must
// not require a DB). NODE_ENV/DATABASE_URL are pinned here so env validation
// passes regardless of cwd — values mirror .env.development.
export default defineConfig({
  test: {
    name: "server",
    root: import.meta.dirname,
    environment: "node",
    globals: true,
    watch: false,
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgres://postgres:mypassword@localhost:5432/postgres",
      BETTER_AUTH_SECRET: "local-dev-placeholder-not-a-secret",
    },
  },
})
