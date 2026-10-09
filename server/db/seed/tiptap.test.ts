import { describe, expect, it } from "vitest"

import { plainText, readingMinutes, toTipTap } from "./tiptap"

describe("article bodies → TipTap JSON", () => {
  const doc = toTipTap([
    { type: "p", text: "The lead paragraph." },
    { type: "h2", text: "A heading" },
    { type: "quote", text: "A quote." },
    {
      type: "list",
      items: ["Lower the stakes. Shrink the next step.", "Single sentence"],
    },
  ])

  it("keeps the first paragraph first, so it renders as the lead", () => {
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "The lead paragraph." }],
    })
  })

  it("maps headings and quotes", () => {
    expect(doc.content[1]).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "A heading" }],
    })
    expect(doc.content[2]).toEqual({
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A quote." }] },
      ],
    })
  })

  it('turns the "bold up to the first ". "" rule into a real bold mark', () => {
    const list = doc.content[3]
    expect(list.type).toBe("bulletList")
    if (list.type !== "bulletList") return
    expect(list.content[0].content[0].content).toEqual([
      { type: "text", text: "Lower the stakes.", marks: [{ type: "bold" }] },
      { type: "text", text: " Shrink the next step." },
    ])
    expect(list.content[1].content[0].content).toEqual([
      { type: "text", text: "Single sentence" },
    ])
  })

  it("measures reading time the way the site always has (words ÷ 220)", () => {
    expect(plainText(doc)).toBe(
      "The lead paragraph. A heading A quote. Lower the stakes. Shrink the next step. Single sentence"
    )
    expect(readingMinutes("word ".repeat(660).trim())).toBe(3)
    expect(readingMinutes("one")).toBe(1)
  })
})
