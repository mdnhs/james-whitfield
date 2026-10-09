import { expect, test } from "@playwright/test"

import { settle } from "../support/settle"
import { PARITY_ROUTES } from "./routes"

// With reduced motion the GSAP reveals never hide anything, so full-page
// shots are deterministic. The WebGL hero canvas is masked because its
// shader animates on a clock.
test.use({ reducedMotion: "reduce" })

for (const route of PARITY_ROUTES) {
  test(`parity: ${route.name}`, async ({ page }) => {
    await page.goto(route.path)
    await settle(page)
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: true,
      mask: [page.locator("canvas")],
    })
  })
}
