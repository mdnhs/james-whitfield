import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { icoSize, icoToPng, lottieSize, svgProblem } from "./formats"

describe("svgProblem", () => {
  it("passes a plain drawing", () => {
    expect(
      svgProblem(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><use href="#g"/><circle r="4" fill="url(#g)" class="icon"/></svg>'
      )
    ).toBeNull()
  })
  it.each([
    "<svg><script>alert(1)</script></svg>",
    '<svg onload="alert(1)"></svg>',
    "<svg><a href='javascript:alert(1)'>x</a></svg>",
    "<svg><foreignObject><div/></foreignObject></svg>",
    '<svg><set attributeName="href" to="x"/></svg>',
    '<svg><a xlink:href="&#106;avascript:alert(1)"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg/>',
    '<svg><image href="data:text/html;base64,AAAA"/></svg>',
  ])("refuses %s", (text) => expect(svgProblem(text)).not.toBeNull())
})

describe("lottieSize", () => {
  const anim = { v: "5.7.4", fr: 30, ip: 0, op: 60, w: 512, h: 256, layers: [] }
  it("reads the canvas size", () =>
    expect(lottieSize(JSON.stringify(anim))).toEqual({
      width: 512,
      height: 256,
    }))
  it.each([
    '{"a":1}',
    "{not json",
    "[]",
    JSON.stringify({ ...anim, layers: 1 }),
  ])("refuses %s", (text) => expect(lottieSize(text)).toBeNull())
})

// An .ico wrapping one PNG-encoded image (as modern icons do).
async function pngIco(size: number) {
  const png = await sharp({
    create: { width: size, height: size, channels: 4, background: "#0f8" },
  })
    .png()
    .toBuffer()
  const head = Buffer.alloc(22)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(1, 4)
  head[6] = size % 256
  head[7] = size % 256
  head.writeUInt32LE(png.length, 14)
  head.writeUInt32LE(22, 18)
  return Buffer.concat([head, png])
}

// An .ico wrapping one 32-bit BMP image.
function bmpIco(size: number) {
  const pixels = Buffer.alloc(size * size * 4, 0xff)
  const dib = Buffer.alloc(40)
  dib.writeUInt32LE(40, 0)
  dib.writeInt32LE(size, 4)
  dib.writeInt32LE(size * 2, 8)
  dib.writeUInt16LE(1, 12)
  dib.writeUInt16LE(32, 14)
  const data = Buffer.concat([dib, pixels])
  const head = Buffer.alloc(22)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(1, 4)
  head[6] = size
  head[7] = size
  head.writeUInt32LE(data.length, 14)
  head.writeUInt32LE(22, 18)
  return Buffer.concat([head, data])
}

describe("ico", () => {
  it("measures and rasterises a PNG entry (256 is stored as 0)", async () => {
    const ico = await pngIco(256)
    expect(icoSize(ico)).toEqual({ width: 256, height: 256 })
    const png = await icoToPng(ico)
    expect((await sharp(png!).metadata()).width).toBe(256)
  })
  it("rasterises a 32-bit BMP entry", async () => {
    const png = await icoToPng(bmpIco(16))
    expect(await sharp(png!).metadata()).toMatchObject({
      format: "png",
      width: 16,
      height: 16,
    })
  })
  it("ignores entries that point outside the file", async () => {
    const ico = bmpIco(16).subarray(0, 40)
    expect(icoSize(ico)).toBeNull()
    expect(await icoToPng(ico)).toBeNull()
  })
})
