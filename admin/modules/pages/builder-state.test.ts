import { describe, expect, it } from "vitest"

import type { DraftDocument } from "@/blocks/page"
import { BLOCKS } from "@/blocks/registry"

import { BLOCK_ICONS } from "./block-icons"
import {
  addableTypes,
  docReducer,
  errorsByBlock,
  newBlock,
} from "./builder-state"

const empty: DraftDocument = { blocks: [] }

describe("builder state", () => {
  it("adds heroes first, others last, with unique anchors and fresh ids", () => {
    let doc = docReducer(empty, { type: "add", blockType: "faq" })
    doc = docReducer(doc, { type: "add", blockType: "faq" })
    doc = docReducer(doc, { type: "add", blockType: "hero.page" })
    expect(doc.blocks.map((b) => [b.type, b.anchor])).toEqual([
      ["hero.page", "home"],
      ["faq", "faq"],
      ["faq", "faq-2"],
    ])
    expect(new Set(doc.blocks.map((b) => b.id)).size).toBe(3)
    expect(doc.blocks[1]!.data).toMatchObject({ selection: { mode: "all" } })
  })
  it("offers only blocks that can publish on this page", () => {
    const home = addableTypes("home", empty)
    expect(home).toContain("hero.home")
    expect(home).not.toContain("richtext")
    expect(home).not.toContain("services.grid")
    const withHero = { blocks: [newBlock("hero.page", empty)] }
    expect(addableTypes("custom", withHero)).not.toContain("hero.page")
    expect(addableTypes("custom", withHero)).toContain("richtext")
  })
  it("moves, edits and removes", () => {
    let doc = docReducer(empty, { type: "add", blockType: "faq" })
    doc = docReducer(doc, { type: "add", blockType: "fit" })
    doc = docReducer(doc, { type: "move", from: 1, to: 0 })
    expect(doc.blocks.map((b) => b.type)).toEqual(["fit", "faq"])
    const id = doc.blocks[0]!.id
    doc = docReducer(doc, { type: "meta", id, patch: { hidden: true } })
    doc = docReducer(doc, { type: "data", id, data: { title: "T" } })
    expect(doc.blocks[0]).toMatchObject({ hidden: true, data: { title: "T" } })
    expect(docReducer(doc, { type: "remove", id }).blocks).toHaveLength(1)
  })
  it("maps publish errors onto blocks", () => {
    const doc = docReducer(
      docReducer(empty, { type: "add", blockType: "faq" }),
      {
        type: "add",
        blockType: "fit",
      }
    )
    const map = errorsByBlock(
      {
        "blocks.1.data.title": ["Required"],
        "blocks.0.anchor": ["Taken"],
        _media: ["x"],
      },
      doc
    )
    expect(map.get(doc.blocks[1]!.id)).toEqual({ title: ["Required"] })
    expect(map.get(doc.blocks[0]!.id)).toEqual({ $anchor: ["Taken"] })
  })
  it("has an icon for every block", () => {
    for (const b of BLOCKS) expect(BLOCK_ICONS[b.icon], b.type).toBeDefined()
  })
})
