import { defineConfig } from "vite-plus";
import { nitro } from "nitro/vite";

import { solidStart } from "@solidjs/start/config";
import solid from "vite-plugin-solid";
import { lazyPlugins } from "vite-plus";

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
    return [solidStart(), nitro(), solid()];
  }),
});
