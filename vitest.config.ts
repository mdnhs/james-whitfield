import path from "node:path"

import { defineConfig } from "vitest/config"

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
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
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
    ],
  },
})
