import path from "node:path"

import { defineConfig } from "vitest/config"

import { TEST_ENV } from "./tests/test-env.mjs"

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // `server-only` throws outside a React Server Component bundle.
      "server-only": path.join(root, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    env: { ...TEST_ENV },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          setupFiles: ["tests/setup/dom.ts"],
          include: ["**/*.test.{ts,tsx}"],
          exclude: [
            "node_modules/**",
            ".next/**",
            ".kilo/**",
            "tests/integration/**",
            "tests/e2e/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/setup/global-setup.ts"],
          // One shared database: files run one after another.
          fileParallelism: false,
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
})
