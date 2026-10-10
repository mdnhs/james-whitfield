import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"
import { settle } from "../support/settle"

// Ruling R10: a visible raster may be at most twice its rendered size × DPR
// (next/image's widths step by ≤ 1.6×), and every <img> has an alt attribute
// ("" for decorative images is fine; Phase 7 checks content images have text).
const OVERSIZE = 2

test.use({ reducedMotion: "reduce" })

for (const route of PARITY_ROUTES) {
  test(`budget: images on ${route.name} have alt and fit their slot`, async ({
    page,
  }) => {
    await page.goto(route.path)
    await settle(page)
    const dpr = await page.evaluate(() => window.devicePixelRatio)
    const images = await page.locator("img").evaluateAll((elements) =>
      elements.map((element) => {
        const img = element as HTMLImageElement
        return {
          src: img.currentSrc || img.src,
          alt: img.getAttribute("alt"),
          natural: img.naturalWidth,
          shown: img.getBoundingClientRect().width,
          visible: img.checkVisibility(),
        }
      })
    )
    const missingAlt = images.filter((i) => i.alt === null).map((i) => i.src)
    const oversized = images
      .filter((i) => i.visible && i.shown > 0 && !/\.svg(\?|$)/.test(i.src))
      .filter((i) => i.natural > Math.max(i.shown * dpr * OVERSIZE, 64))
      .map(
        (i) => `${i.src} (${i.natural}px for ${Math.round(i.shown)}px @${dpr}x)`
      )
    expect({ missingAlt, oversized }).toEqual({ missingAlt: [], oversized: [] })
  })
}
