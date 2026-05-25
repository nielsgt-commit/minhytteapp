import * as path from "node:path"
import { defineConfig } from "vitest/config"
import packageJson from "../package.json" with { type: "json" }

// Runs only *.e2e.test.* files. Requires the dev server (and DB) to be reachable
// at the URL given by VITE_TEST_HEALTH_URL / VITE_TEST_API_URL.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@server": path.resolve(import.meta.dirname, "../server/src"),
    },
  },

  test: {
    root: import.meta.dirname,
    name: `${packageJson.name}-e2e`,
    environment: "node",
    globals: true,
    watch: false,
    include: ["**/*.e2e.test.*"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
})
