import js from "@eslint/js"
import vitestPlugin from "@vitest/eslint-plugin"
import { defineConfig } from "eslint/config"
import prettierConfig from "eslint-config-prettier/flat"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"
import globals from "globals"
import { configs } from "typescript-eslint"

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

  prettierConfig,
)

export default eslintConfig
