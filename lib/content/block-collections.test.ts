import { describe, expect, it } from "vitest"

import { collectionsOf } from "./block-collections"

describe("collectionsOf", () => {
  it.each([
    ["faq", ["faqs"]],
    ["band", ["cta-bands"]],
    ["process", ["steps"]],
    ["testimonials", ["testimonials"]],
    ["services.grid", ["services"]],
    ["services.plans", ["plans"]],
    ["hero.page", []],
  ] as const)("%s -> %j", (type, expected) => {
    expect(collectionsOf(type)).toEqual(expected)
  })
})
