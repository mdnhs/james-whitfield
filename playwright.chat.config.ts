import { defineConfig, devices } from "@playwright/test"

import base from "./playwright.config"

// The chat spec switches the shared chat and assistant settings on, so it
// runs in its own invocation (fresh seed via globalSetup).
export default defineConfig({
  ...base,
  projects: [
    base.projects!.find((p) => p.name === "setup")!,
    {
      name: "chat",
      testMatch: /chat\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
