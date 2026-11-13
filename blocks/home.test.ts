import { describe, expect, it } from "vitest"

import { heroHome } from "./home"

const media = { mediaId: "00000000-0000-4000-8000-000000000001" }
const link = { label: "L", href: "/x" }
// A hero.home block as stored before the background fields existed.
const legacy = {
  eyebrow: "E",
  headline: { lead: "a", muted: "b", tail: "c" },
  description: "D",
  primaryCta: link,
  secondaryCta: link,
  members: {
    count: { kind: "text", text: "T" },
    label: "L",
    avatars: [media, media, media],
  },
}

describe("hero.home background", () => {
  it("parses data saved before the field existed, background unset", () => {
    const parsed = heroHome.schema.parse(legacy)
    expect(parsed.background).toEqual({ image: null, depth: null })
    expect(parsed).toEqual({
      ...legacy,
      background: { image: null, depth: null },
    })
  })

  it("accepts a photo with and without its depth map", () => {
    const photo = { mediaId: "00000000-0000-4000-8000-000000000002" }
    expect(
      heroHome.schema.parse({ ...legacy, background: { image: photo } })
        .background
    ).toEqual({ image: photo, depth: null })
    expect(
      heroHome.schema.parse({
        ...legacy,
        background: { image: photo, depth: media },
      }).background
    ).toEqual({ image: photo, depth: media })
  })

  it("rejects a malformed reference", () => {
    expect(
      heroHome.schema.safeParse({
        ...legacy,
        background: { image: { mediaId: "nope" }, depth: null },
      }).success
    ).toBe(false)
  })
})
