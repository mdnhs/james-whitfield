import { describe, expect, it } from "vitest"

import { sniff } from "./sniff"

const bytes = (...parts: (number[] | string)[]) =>
  Buffer.concat(
    parts.map((p) =>
      typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p)
    )
  )

describe("sniff", () => {
  it.each([
    [bytes([0xff, 0xd8, 0xff, 0xe0]), "jpg"],
    [bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png"],
    [bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "webp"],
    [bytes([0, 0, 0, 0x1c], "ftypavif"), "avif"],
    [bytes("%PDF-1.7"), "pdf"],
  ])("recognises %#", (input, ext) => expect(sniff(input)?.ext).toBe(ext))
  // §14: SVG is script, whatever its extension says.
  it.each([
    bytes("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    bytes("GIF89a"),
    bytes(""),
  ])("refuses %#", (input) => expect(sniff(input)).toBeNull())
})
