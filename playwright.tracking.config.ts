import { defineConfig, devices } from "@playwright/test"

import base from "./playwright.config"

// Ruling R19: tracking specs switch shared site settings on, so they run in
// their own invocation (fresh seed via globalSetup), never beside parity or
// the other public specs.
export default defineConfig({
  ...base,
  projects: [
    base.projects!.find((p) => p.name === "setup")!,
    {
      name: "tracking",
      testMatch: /tracking\/.*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
