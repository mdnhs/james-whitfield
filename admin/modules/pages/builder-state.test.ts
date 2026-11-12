import { describe, expect, it } from "vitest"

import type { DraftDocument } from "@/blocks/page"
import { BLOCKS } from "@/blocks/registry"

import { BLOCK_ICONS } from "./block-icons"
import {
  docReducer,
  errorsByBlock,
  firstVisibleErrorBlock,
  publishProblems,
} from "./builder-state"

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
  it("words every publish error for the page banner", () => {
    const mk = (id: string, hidden: boolean) => ({
      id,
      type: "faq" as const,
      anchor: id,
      chapter: null,
      hidden,
      joinPrevious: false,
      data: {},
    })
    const doc: DraftDocument = { blocks: [mk("a", false), mk("b", true)] }
    const problems = publishProblems(
      {
        "blocks.0.data.title": ["Required"],
        "blocks.0.anchor": ['Anchor "a" is already used on this page'],
        "blocks.1.data.title": ["Required"],
        _: ["Broken"],
      },
      doc
    )
    expect(problems).toEqual([
      { text: "FAQ: Required", developer: false },
      {
        text: 'FAQ: Anchor "a" is already used on this page',
        developer: true,
      },
      { text: "FAQ (hidden section): Required", developer: true },
      { text: "Broken", developer: true },
    ])
  })
  it("auto-selects only a visible block with an error", () => {
    const mk = (id: string, hidden: boolean) => ({
      id,
      type: "faq" as const,
      anchor: id,
      chapter: null,
      hidden,
      joinPrevious: false,
      data: {},
    })
    const doc: DraftDocument = {
      blocks: [mk("a", true), mk("b", false), mk("c", false)],
    }
    const errors = errorsByBlock(
      { "blocks.0.data.x": ["e"], "blocks.2.data.x": ["e"] },
      doc
    )
    expect(firstVisibleErrorBlock(errors, doc)).toBe("c")
    const hiddenOnly = errorsByBlock({ "blocks.0.data.x": ["e"] }, doc)
    expect(firstVisibleErrorBlock(hiddenOnly, doc)).toBeNull()
  })
  it("has an icon for every block", () => {
    for (const b of BLOCKS) expect(BLOCK_ICONS[b.icon], b.type).toBeDefined()
  })
})
