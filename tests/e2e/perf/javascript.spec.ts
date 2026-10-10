import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"

// Ruling R10: compressed script bytes per public route, set in Step 3 to the
// measured maximum + 15%, rounded up to 10 KB. Raise it only deliberately.
// Measured 2026-10-10: home, about, services, how-it-works and insights
// 258 KB, article 267 KB, contact 294 KB … max 294 KB.
const JS_BUDGET_KB = 340

for (const route of PARITY_ROUTES) {
  test(`budget: ${route.name} loads at most ${JS_BUDGET_KB} KB of JavaScript`, async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "desktop",
      "the same bundle ships to every viewport"
    )
    await page.goto(route.path)
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {})
    const bytes = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry as PerformanceResourceTiming)
        .filter(
          (entry) =>
            entry.initiatorType === "script" || /\.js(\?|$)/.test(entry.name)
        )
        .reduce((sum, entry) => sum + entry.encodedBodySize, 0)
    )
    const kb = Math.round(bytes / 1024)
    console.log(`[budget] ${route.path} ${kb} KB of JavaScript`)
    expect(kb).toBeLessThanOrEqual(JS_BUDGET_KB)
  })
}
