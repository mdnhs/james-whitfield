import { defineConfig, devices } from "@playwright/test"

import { E2E_ENV, E2E_PORT } from "./tests/e2e/fixtures/env"

const PORT = E2E_PORT

// Run once, on desktop: specs that change accounts (passwords, 2FA,
// sign-out), and specs that pin their own desktop viewport and scroll with
// the mouse wheel. Everything else, admin shell included, runs on all
// viewports.
const DESKTOP_ONLY = ["**/admin/auth/**", "**/navigation/activity.spec.ts"]

// Admin specs run in their own projects, after the setup project has signed
// the E2E roles in; public-site specs (parity, navigation) never wait on it.
const ADMIN = "**/admin/**/*.spec.ts"

const VIEWPORTS = [
  {
    name: "desktop",
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1440, height: 900 },
    },
  },
  {
    name: "tablet",
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 834, height: 1112 },
    },
  },
  { name: "mobile", use: { ...devices["Pixel 7"] } },
]

const desktopOnly = (name: string) => (name === "desktop" ? [] : DESKTOP_ONLY)

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
    // Signs each E2E role in once and saves its storage state.
    {
      name: "setup",
      testMatch: /admin\/auth\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Public site. Parity baselines live under these project names.
    ...VIEWPORTS.map(({ name, use }) => ({
      name,
      use,
      testIgnore: [ADMIN, ...desktopOnly(name)],
    })),
    ...VIEWPORTS.map(({ name, use }) => ({
      name: `admin-${name}`,
      use,
      dependencies: ["setup"],
      testMatch: ADMIN,
      testIgnore: desktopOnly(name),
    })),
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
