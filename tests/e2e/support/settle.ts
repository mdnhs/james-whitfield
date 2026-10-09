import type { Page } from "@playwright/test"

// Full-page screenshots only compare once nothing is still arriving: scroll
// the page once so lazy images load, return to the top, then wait for fonts
// and every image. Lazy images inside collapsed or pinned containers never
// enter the viewport, so they are forced eager. The footer links to routes
// that do not exist yet; their router prefetches stall and keep the network
// from ever going idle, so that wait is bounded rather than required.
export async function settle(page: Page) {
  await page.evaluate(async () => {
    for (const image of Array.from(document.images)) image.loading = "eager"
    const step = window.innerHeight
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    window.scrollTo(0, 0)
    await document.fonts.ready
  })
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {})
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete)
  )
  await page.waitForTimeout(400)
}
