import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { probeImage } from "./probe"

describe("probeImage", () => {
  it("reads size, a 16 px WebP blur and the dominant colour", async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 16,
        channels: 3,
        background: { r: 230, g: 20, b: 20 },
      },
    })
      .png()
      .toBuffer()
    const probe = await probeImage(png)
    expect(probe.width).toBe(32)
    expect(probe.height).toBe(16)
    expect(probe.blurDataUrl).toMatch(/^data:image\/webp;base64,/)
    expect(probe.dominantColor).toMatch(/^#[0-9a-f]{6}$/)
    expect(
      Number.parseInt(probe.dominantColor!.slice(1, 3), 16)
    ).toBeGreaterThan(200)
  })
  it("only measures vector images", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>'
    )
    expect(await probeImage(svg, { raster: false })).toEqual({
      width: 24,
      height: 24,
      blurDataUrl: null,
      dominantColor: null,
    })
  })
})
