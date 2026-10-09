import { expect, test } from "@playwright/test"

import { DASHBOARD_FIXTURE } from "../../fixtures/dashboard"
import { STORAGE } from "../../support/storage"

// Shell and dashboard in light and dark, on every viewport (docs/plan.md
// Phase 2, item 10). The numbers are pinned by the fixture, relative times
// are measured from its generatedAt, and the browser clock is frozen at the
// same instant. Charts skip their animation under reduced motion, so the
// capture is stable, and the greeting goes by the answer's generatedAt
// (11:00 in Dublin: "Good morning"). Titles start with "visual:" because
// the baselines are macOS-only until Linux ones are recorded (Phase 11),
// and CI skips them.
const NOW = new Date(DASHBOARD_FIXTURE.generatedAt)

test.use({ storageState: STORAGE.owner, reducedMotion: "reduce" })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme })

    test("visual: dashboard", async ({ page }) => {
      await page.route("**/api/v1/admin/dashboard", (route) =>
        route.fulfill({ json: DASHBOARD_FIXTURE })
      )
      await page.goto("/admin")
      await expect(
        page
          .getByRole("region", { name: "Team activity" })
          .getByRole("listitem")
      ).toHaveCount(4)
      await page.evaluate(() => document.fonts.ready)
      await expect(page.getByTestId("greeting")).toHaveText("Good morning, Sam")
      await expect(page).toHaveScreenshot(`dashboard-${colorScheme}.png`, {
        fullPage: true,
      })
    })

    test("visual: design system", async ({ page }) => {
      await page.goto("/admin/design")
      await expect(page.locator(".recharts-surface").first()).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`design-${colorScheme}.png`, {
        fullPage: true,
      })
    })
  })
}
