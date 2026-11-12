import { describe, expect, it } from "vitest"

import { sameStructure, structureOf } from "./structure"

const block = (over: Record<string, unknown> = {}) => ({
  id: "a",
  type: "richtext",
  anchor: "content",
  chapter: null as string | null,
  hidden: false,
  joinPrevious: false,
  data: { x: 1 },
  ...over,
})
const doc = (...blocks: ReturnType<typeof block>[]) => ({ blocks })

describe("sameStructure", () => {
  const base = doc(block(), block({ id: "b", type: "hero.page", anchor: "h" }))

  it("ignores id, chapter, joinPrevious and data", () => {
    const next = doc(
      block({ id: "z", chapter: "New", joinPrevious: true, data: { x: 2 } }),
      block({ id: "y", type: "hero.page", anchor: "h", data: {} })
    )
    expect(sameStructure(base, next)).toBe(true)
  })

  it("detects an added block", () => {
    expect(sameStructure(base, doc(...base.blocks, block({ id: "c" })))).toBe(
      false
    )
  })

  it("detects a removed block", () => {
    expect(sameStructure(base, doc(base.blocks[0]!))).toBe(false)
  })

  it("detects a swapped order", () => {
    expect(sameStructure(base, doc(base.blocks[1]!, base.blocks[0]!))).toBe(
      false
    )
  })

  it("detects a changed anchor, type or hidden flag", () => {
    for (const over of [
      { anchor: "other" },
      { type: "about.intro" },
      { hidden: true },
    ]) {
      expect(sameStructure(base, doc(block(over), base.blocks[1]!))).toBe(false)
    }
  })

  it("structureOf keeps only type, anchor and hidden", () => {
    expect(structureOf(doc(block()))).toEqual([
      { type: "richtext", anchor: "content", hidden: false },
    ])
  })
})
