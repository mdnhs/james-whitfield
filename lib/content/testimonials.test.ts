import { describe, expect, it } from "vitest"

import { testimonials } from "@/blocks/home"

import { COLLECTION_SCHEMAS } from "./collections"
import { bySource } from "./select"

const schema = COLLECTION_SCHEMAS.testimonials
const base = {
  quote: "Lovely",
  authorName: "Ann",
  authorRole: "Client",
  avatar: { mediaId: "00000000-0000-4000-8000-000000000001" },
  isVisible: true,
}

describe("testimonials collection schema", () => {
  it("parses old rows with the defaults", () => {
    const row = schema.parse(base)
    expect(row.source).toBe("site")
    expect(row.rating).toBe(5)
    expect(row.reviewUrl).toBe("")
  })
  it("allows a missing avatar", () => {
    expect(schema.parse({ ...base, avatar: null }).avatar).toBeNull()
    const rest: Partial<typeof base> = { ...base }
    delete rest.avatar
    expect(schema.parse(rest).avatar).toBeNull()
  })
  it("accepts ratings 1-5 and rejects 0 and 6", () => {
    for (const rating of [1, 3, 5])
      expect(
        schema.safeParse({ ...base, source: "google", rating }).success
      ).toBe(true)
    for (const rating of [0, 6, 2.5])
      expect(
        schema.safeParse({ ...base, source: "google", rating }).success
      ).toBe(false)
  })
  it("requires reviewUrl to be https or empty", () => {
    const ok = (reviewUrl: string) =>
      schema.safeParse({ ...base, reviewUrl }).success
    expect(ok("")).toBe(true)
    expect(ok("https://g.co/review/1")).toBe(true)
    expect(ok("http://g.co/review/1")).toBe(false)
    expect(ok("not a url")).toBe(false)
  })
})

describe("testimonials block schema", () => {
  it("defaults show and google", () => {
    const data = testimonials.schema.parse({
      variant: "home",
      eyebrow: "E",
      title: "T",
      selection: { mode: "all" },
    })
    expect(data.show).toBe("all")
    expect(data.google).toEqual({
      rating: null,
      count: null,
      profileUrl: "",
      writeUrl: "",
    })
  })
  it("bounds the google fields", () => {
    const parse = (google: object) =>
      testimonials.schema.safeParse({
        variant: "home",
        eyebrow: "E",
        title: "T",
        selection: { mode: "all" },
        google,
      }).success
    expect(parse({ rating: 4.9, count: 23 })).toBe(true)
    expect(parse({ rating: 5.1 })).toBe(false)
    expect(parse({ count: -1 })).toBe(false)
    expect(parse({ profileUrl: "http://x.co" })).toBe(false)
  })
})

describe("bySource", () => {
  const items = [
    { id: "a", source: "site" as const },
    { id: "b", source: "google" as const },
  ]
  it("filters by source", () => {
    expect(bySource(items, "google").map((i) => i.id)).toEqual(["b"])
    expect(bySource(items, "site").map((i) => i.id)).toEqual(["a"])
    expect(bySource(items, "all")).toEqual(items)
  })
})
