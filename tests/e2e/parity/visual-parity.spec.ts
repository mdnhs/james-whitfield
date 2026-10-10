import { expect, test } from "@playwright/test"

import { encodeConsent } from "../../../lib/tracking/consent"
import { E2E_ORIGIN } from "../fixtures/env"
import { settle } from "../support/settle"
import { PARITY_ROUTES } from "./routes"

// With reduced motion the GSAP reveals never hide anything, so full-page
// shots are deterministic. The WebGL hero canvas is masked because its
// shader animates on a clock.
test.use({ reducedMotion: "reduce" })

// The seed keeps the banner off, so nothing tracking-related renders. If a
// developer has switched it on locally, a stored "reject" keeps the banner
// (a fixed overlay) out of the screenshots.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "mk_consent",
      value: encodeConsent({
        id: "00000000-0000-4000-8000-000000000000",
        v: 1,
        ts: Math.floor(Date.now() / 1000),
        a: 0,
        m: 0,
      }),
      url: E2E_ORIGIN,
    },
  ])
})

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
