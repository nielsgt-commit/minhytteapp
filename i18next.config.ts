import { defineConfig } from "i18next-cli"

export default defineConfig({
  locales: ["en", "nb"],
  extract: {
    input: ["client/src/**/*.{ts,tsx}"],
    ignore: ["**/node_modules/**", "**/*.test.{ts,tsx}", "**/routeTree.gen.ts"],
    output: "client/src/i18n/locales/{{language}}/{{namespace}}.json",
    defaultNS: "common",
    keySeparator: false,
    nsSeparator: false,
    primaryLanguage: "en",
    secondaryLanguages: ["nb"],
    // Natural-key strategy: use the key itself as the EN value
    // and leave NB blank for translators to fill in.
    defaultValue: (key, _ns, language) => (language === "en" ? key : ""),
    sort: true,
    indentation: 2,
  },
})
