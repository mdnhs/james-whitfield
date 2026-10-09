import { defineConfig, devices } from "@playwright/test"

import { E2E_ENV, E2E_PORT } from "./tests/e2e/fixtures/env"

const PORT = E2E_PORT

// The admin is a desktop tool first; its specs run once, in the desktop
// project. Parity and navigation specs keep all three viewports.
const DESKTOP_ONLY = ["**/admin/**"]

// CI builds in its own step, so the server only needs starting.
const command = process.env.E2E_SKIP_BUILD
  ? `pnpm start --port ${PORT}`
  : `pnpm build && pnpm start --port ${PORT}`

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Baselines are per platform: macOS and Linux render fonts differently.
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      animations: "disabled",
      caret: "hide",
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet",
      testIgnore: DESKTOP_ONLY,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 834, height: 1112 },
      },
    },
    {
      name: "mobile",
      testIgnore: DESKTOP_ONLY,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // `next start` prints a warning about `output: "standalone"`; it still serves.
    command,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: E2E_ENV,
  },
})
