import react from "@vitejs/plugin-react"
import * as path from "node:path"
import { configDefaults, defineConfig } from "vitest/config"
import packageJson from "../package.json" with { type: "json" }
import tanstackRouter from "@tanstack/router-plugin/vite"
import { VitePWA } from "vite-plugin-pwa"


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "minhytte.app",
        short_name: "minhytte",
        description: "Hold styr på hytta — bookinger, vedlikehold og oppgaver.",
        lang: "nb",
        theme_color: "#1f4332",
        background_color: "#1f4332",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
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

    exclude: [...configDefaults.exclude, "**/*.e2e.test.*"],

    server: {
      deps: {
        inline: ["@navikt/aksel-icons"],
      },
    },
  },
})