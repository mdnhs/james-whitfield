import { defineConfig, devices } from "@playwright/test"

import base from "./playwright.config"

// Ruling R19: the assistant specs switch a shared site setting on, so they
// run in their own invocation (fresh seed via globalSetup).
export default defineConfig({
  ...base,
  projects: [
    base.projects!.find((p) => p.name === "setup")!,
    {
      name: "ai",
      testMatch: /ai\/.*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
  ],
})
