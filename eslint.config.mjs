import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // docs/brief.md §5.4: dependencies point downward. Client and shared code
  // may use server types, never server values (they would pull secrets and
  // the database into the browser bundle).
  {
    files: [
      "admin/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "features/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "blocks/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server", "@/server/**"],
              allowTypeImports: true,
              message:
                "Client and shared code must not import server modules (docs/brief.md §5.4). Type-only imports are fine.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling output and editor worktrees:
    ".kilo/**",
    "dist/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
