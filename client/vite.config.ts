import react from "@vitejs/plugin-react"
import * as path from "node:path"
import { defineConfig } from "vitest/config"
import packageJson from "../package.json" with { type: "json" }
import tanstackRouter from "@tanstack/router-plugin/vite"


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@server": path.resolve(import.meta.dirname, "../server/src"),
    },
  },

  server: {
    open: true,
    proxy: { "/api": "http://localhost:3001" }
},

  test: {
    root: import.meta.dirname,
    name: packageJson.name,
    environment: "jsdom",

    typecheck: {
      enabled: true,
      tsconfig: path.join(import.meta.dirname, "tsconfig.json"),
    },

    globals: true,
    watch: false,
    setupFiles: ["./src/setupTests.ts"],
  },
})