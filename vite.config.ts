import { defineConfig } from "vite-plus";
import { nitro } from "nitro/vite";

import { solidStart } from "@solidjs/start/config";
import solid from "vite-plugin-solid";
import { lazyPlugins } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [".agents/skills/**"],
  },
  lint: {
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "solid", specifier: "eslint-plugin-solid" },
      { name: "playwright", specifier: "eslint-plugin-playwright" },
    ],
    plugins: ["typescript", "vitest"],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "solid/jsx-no-duplicate-props": "error",
      "solid/jsx-no-undef": "error",
      "solid/jsx-uses-vars": "error",
      "solid/no-innerhtml": "error",
      "solid/jsx-no-script-url": "error",
      "solid/no-destructure": "error",
      "solid/prefer-for": "error",
      "solid/components-return-once": "warn",
      "solid/reactivity": "warn",
      "solid/event-handlers": "warn",
      "solid/imports": "warn",
      "solid/style-prop": "warn",
      "solid/no-react-deps": "warn",
      "solid/no-react-specific-props": "warn",
      "solid/self-closing-comp": "warn",
    },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        plugins: ["typescript", "vitest"],
        rules: {
          "@typescript-eslint/no-explicit-any": "off",
          "vitest/no-disabled-tests": "error",
        },
      },
      {
        // Playwright e2e specs (tests/mocked-ui/**). Recommended rule set from
        // eslint-plugin-playwright's flat/recommended, mirroring gtabs config.
        // .spec.ts files are disjoint from the vitest .test.ts override above.
        files: ["**/*.spec.ts"],
        jsPlugins: [{ name: "playwright", specifier: "eslint-plugin-playwright" }],
        rules: {
          "playwright/consistent-spacing-between-blocks": "warn",
          "playwright/expect-expect": "warn",
          "playwright/max-nested-describe": "warn",
          "playwright/missing-playwright-await": "error",
          "playwright/no-conditional-expect": "warn",
          "playwright/no-conditional-in-test": "warn",
          "playwright/no-duplicate-hooks": "warn",
          "playwright/no-duplicate-slow": "warn",
          "playwright/no-element-handle": "warn",
          "playwright/no-eval": "warn",
          "playwright/no-focused-test": "error",
          "playwright/no-force-option": "warn",
          "playwright/no-nested-step": "warn",
          "playwright/no-networkidle": "error",
          "playwright/no-page-pause": "warn",
          "playwright/no-skipped-test": "warn",
          "playwright/no-standalone-expect": "error",
          "playwright/no-unnecessary-assertions": "error",
          "playwright/no-unsafe-references": "error",
          "playwright/no-unused-locators": "error",
          "playwright/no-useless-await": "warn",
          "playwright/no-useless-not": "warn",
          "playwright/no-wait-for-navigation": "error",
          "playwright/no-wait-for-selector": "warn",
          "playwright/no-wait-for-timeout": "warn",
          "playwright/prefer-hooks-in-order": "warn",
          "playwright/prefer-hooks-on-top": "warn",
          "playwright/prefer-locator": "warn",
          "playwright/prefer-to-have-count": "warn",
          "playwright/prefer-to-have-length": "warn",
          "playwright/prefer-web-first-assertions": "error",
          "playwright/valid-describe-callback": "error",
          "playwright/valid-expect": "error",
          "playwright/valid-expect-in-promise": "error",
          "playwright/valid-test-tags": "error",
          "playwright/valid-title": "error",
        },
      },
    ],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "~": "/src",
    },
  },
  plugins: lazyPlugins(() => {
    if (process.env.VITEST) return [solid({ hot: false })];
    return [
      solidStart({ middleware: "src/middleware/index.ts" }),
      nitro({ preset: "vercel" }),
      tailwindcss(),
      solid(),
    ];
  }),
});
