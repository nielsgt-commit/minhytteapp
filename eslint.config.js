import { readdirSync } from "node:fs"
import path from "node:path"
import js from "@eslint/js"
import vitestPlugin from "@vitest/eslint-plugin"
import { defineConfig } from "eslint/config"
import prettierConfig from "eslint-config-prettier/flat"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"
import globals from "globals"
import { configs } from "typescript-eslint"

const FEATURES = readdirSync(
  path.join(import.meta.dirname, "client/src/features"),
  { withFileTypes: true },
)
  .filter(d => d.isDirectory())
  .map(d => d.name)

// Mutation convention (see README "Conventions"): default to
// useMutationWithInvalidation; the rare raw-useMutation sites carry inline
// disables stating their reason. NOTE: flat-config rule options REPLACE
// rather than merge, so this paths list must ride along in every block that
// also configures no-restricted-imports for client files.
const RESTRICTED_CLIENT_IMPORT_PATHS = [
  {
    name: "@tanstack/react-query",
    importNames: ["useMutation"],
    message:
      "Default to useMutationWithInvalidation (@/hooks/useMutationWithInvalidation). Raw useMutation is for onSettled-based invalidation, success-ordering, or shared cross-mutation invalidation — disable this rule inline with the reason.",
  },
]

const eslintConfig = defineConfig(
  {
    name: "global-ignores",
    ignores: [
      "**/*.snap",
      "**/dist/",
      "**/.yalc/",
      "**/build/",
      "**/temp/",
      "**/.temp/",
      "**/.tmp/",
      "**/.yarn/",
      "**/coverage/",
      // Claude Code agent worktrees contain duplicate copies of the
      // codebase; linting them is noise and double-counts every issue.
      "**/.claude/",
      "client/src/routeTree.gen.ts",
    ],
  },
  {
    name: `${js.meta.name}/recommended`,
    ...js.configs.recommended,
  },
  configs.strictTypeChecked,
  configs.stylisticTypeChecked,
  vitestPlugin.configs.recommended,
  {
    name: "eslint-plugin-react/jsx-runtime",
    ...reactPlugin.configs.flat["jsx-runtime"],
  },
  reactHooksPlugin.configs["recommended-latest"],
  {
    name: "main",
    linterOptions: {
      reportUnusedDisableDirectives: 2,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
    rules: {
      "no-undef": [0],
      "@typescript-eslint/no-unused-vars": [
        2,
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": [2, "type"],
      "@typescript-eslint/consistent-type-imports": [
        2,
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: true,
        },
      ],
    },
  },

  {
    // Test files routinely use stub callbacks (`() => {}`), loosely-typed
    // mocks, and async-without-await placeholders. Relaxing these here
    // keeps the strict checks where they matter — production source.
    name: "tests-relaxed",
    files: ["**/*.test.{ts,tsx}", "**/test-utils/**"],
    rules: {
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
      // testing-library's getByLabelText returns HTMLElement; the narrowing
      // cast (as HTMLInputElement) is required for tsc to see `.value`, but
      // eslint's project-service disagrees. The cast is genuinely needed.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },

  // ---- Import boundaries ---------------------------------------------
  // The patterns match import SPECIFIERS, so a relative `../../otherfeature`
  // escape would slip through — none exist today; the alias (@/...) is the
  // universal convention. Feature barrels must stay re-export-only and
  // cycle-free (a barrel importing back through another feature's barrel
  // would silently reintroduce the settlement⇄expenses cycle).

  {
    name: "client-mutation-convention",
    files: ["client/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [2, { paths: RESTRICTED_CLIENT_IMPORT_PATHS }],
    },
  },

  // A feature may deep-import its own files; other features only through
  // their public barrel (@/features/<name>). Features never import routes.
  ...FEATURES.map(
    feature =>
      /** @type {import("eslint").Linter.Config} */ ({
        name: `feature-boundaries/${feature}`,
        files: [`client/src/features/${feature}/**/*.{ts,tsx}`],
        rules: {
          "no-restricted-imports": [
            2,
            {
              paths: RESTRICTED_CLIENT_IMPORT_PATHS,
              patterns: [
                {
                  group: ["@/features/*/**", `!@/features/${feature}/**`],
                  message:
                    "Deep import into another feature. Import its public barrel instead: @/features/<name>.",
                },
                {
                  group: ["@/routes/**"],
                  message:
                    "Features must not import from routes. Move shared code to @/utils or @/components.",
                },
              ],
            },
          ],
        },
      }),
  ),

  {
    name: "components-are-feature-free",
    files: ["client/src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        2,
        {
          paths: RESTRICTED_CLIENT_IMPORT_PATHS,
          patterns: [
            {
              group: ["@/features/**", "@/routes/**"],
              message:
                "Shared components must not depend on features or routes.",
            },
          ],
        },
      ],
    },
  },

  // server/src/shared is the isomorphic kernel bundled into the browser via
  // the @server alias: enforce its documented import contract.
  {
    name: "isomorphic-shared-kernel",
    files: ["server/src/shared/**/*.ts"],
    ignores: ["server/src/shared/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        2,
        {
          patterns: [
            {
              regex: "^(?!\\./|temporal-polyfill$|zod$|superjson$).",
              message:
                "server/src/shared is isomorphic (shared with the browser): only temporal-polyfill, zod, superjson, and sibling ./ imports are allowed — no node:*, pg, drizzle, or other server code.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "isomorphic-shared-kernel-tests",
    files: ["server/src/shared/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        2,
        {
          patterns: [
            {
              regex: "^(?!\\./|temporal-polyfill$|zod$|superjson$|vitest$).",
              message:
                "Shared-kernel tests may additionally import only vitest.",
            },
          ],
        },
      ],
    },
  },

  // Client code may import runtime values only from the kernel; type-only
  // imports (AppRouter, Auth) are fine anywhere on the server.
  {
    name: "client-server-boundary",
    files: ["client/src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        2,
        {
          patterns: [
            {
              group: ["@server/**", "!@server/shared", "!@server/shared/**"],
              allowTypeImports: true,
              message:
                "Client code may import runtime values only from @server/shared (type-only imports are fine anywhere).",
            },
          ],
        },
      ],
    },
  },

  prettierConfig,
)

export default eslintConfig
