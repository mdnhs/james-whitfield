import { expect, test } from "@playwright/test"

// JavaScript is on but its chunks never arrive, so no reveal ever runs
// (and <noscript> does not apply). The CSS failsafe must still show the hero.
test.use({ reducedMotion: "no-preference" })

test("hero copy appears without its animation script", async ({ page }) => {
  // Scripts only: Turbopack also serves CSS from /_next/static/chunks.
  await page.route(/\/_next\/static\/chunks\/.*\.js(\?.*)?$/, (route) =>
    route.abort()
  )
  await page.goto("/about")
  const title = page.getByRole("heading", { level: 1, name: "About" })
  await expect(title).toBeVisible({ timeout: 5_000 })
})
