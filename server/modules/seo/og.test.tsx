import { describe, expect, it } from "vitest"

import { OgCard, renderOg } from "./og"

const subject = {
  title: "Calm is a skill",
  eyebrow: "Anxiety",
  siteName: "Magda Kennedy",
}
const colors = { background: "#030303", text: "#faf6f0", accent: "#d6e8e4" }

describe("share card", () => {
  it("puts the title, eyebrow and wordmark on the card", () => {
    const text = JSON.stringify(OgCard({ ...subject, colors }))
    for (const s of ["Calm is a skill", "Anxiety", "Magda Kennedy"])
      expect(text).toContain(s)
  })
  it("renders a 1200×630 PNG with the committed fonts", async () => {
    const res = await renderOg(subject, colors)
    expect(res.headers.get("content-type")).toBe("image/png")
    const png = new Uint8Array(await res.arrayBuffer())
    expect(
      [...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")
    ).toBe("PNG")
    const view = new DataView(png.buffer)
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630])
  }, 20_000)
})
