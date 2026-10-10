import { defineConfig, devices } from "@playwright/test"

import base from "./playwright.config"

// Ruling R17: the appearance spec publishes themes, so it runs in its own
// invocation (fresh seed via globalSetup), never beside parity.
export default defineConfig({
  ...base,
  projects: [
    base.projects!.find((p) => p.name === "setup")!,
    {
      name: "appearance",
      testMatch: /appearance\/.*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
