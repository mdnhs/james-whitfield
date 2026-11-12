import { describe, expect, it } from "vitest"

import type { DraftDocument } from "@/blocks/page"
import { BLOCKS } from "@/blocks/registry"

import { BLOCK_ICONS } from "./block-icons"
import { docReducer, errorsByBlock } from "./builder-state"

describe("builder state", () => {
  it("applies data and chapter edits only", () => {
    const doc: DraftDocument = {
      blocks: [
        {
          id: "a",
          type: "faq",
          anchor: "faq",
          chapter: null,
          hidden: false,
          joinPrevious: false,
          data: {},
        },
      ],
    }
    let next = docReducer(doc, { type: "data", id: "a", data: { title: "T" } })
    next = docReducer(next, {
      type: "meta",
      id: "a",
      patch: { chapter: "Faq" },
    })
    expect(next.blocks).toHaveLength(1)
    expect(next.blocks[0]).toMatchObject({
      anchor: "faq",
      hidden: false,
      chapter: "Faq",
      data: { title: "T" },
    })
  })
  it("maps publish errors onto blocks", () => {
    const mk = (id: string, type: "faq" | "fit") => ({
      id,
      type,
      anchor: id,
      chapter: null,
      hidden: false,
      joinPrevious: false,
      data: {},
    })
    const doc: DraftDocument = { blocks: [mk("a", "faq"), mk("b", "fit")] }
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
