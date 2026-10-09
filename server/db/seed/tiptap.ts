import "server-only"

import type { RichTextDoc, RichTextNode } from "@/blocks/rich-text"

// The fixtures' article bodies (features/insights/data/article-bodies.ts).
export type LegacyBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }

const text = (value: string) => ({ type: "text" as const, text: value })
const paragraph = (value: string) => ({
  type: "paragraph" as const,
  content: [text(value)],
})

// List items scanned as headed steps: the old renderer set everything up to
// the first ". " in bold. That becomes a real bold mark.
function listItem(value: string) {
  const cut = value.indexOf(". ")
  const content =
    cut === -1
      ? [text(value)]
      : [
          {
            ...text(value.slice(0, cut + 1)),
            marks: [{ type: "bold" as const }],
          },
          text(value.slice(cut + 1)),
        ]
  return {
    type: "listItem" as const,
    content: [{ type: "paragraph" as const, content }],
  }
}

function node(block: LegacyBlock): RichTextNode {
  switch (block.type) {
    case "p":
      return paragraph(block.text)
    case "h2":
      return {
        type: "heading",
        attrs: { level: 2 },
        content: [text(block.text)],
      }
    case "quote":
      return { type: "blockquote", content: [paragraph(block.text)] }
    case "list":
      return { type: "bulletList", content: block.items.map(listItem) }
  }
}

export const toTipTap = (blocks: LegacyBlock[]): RichTextDoc => ({
  type: "doc",
  content: blocks.map(node),
})

const inline = (content?: { text: string }[]) =>
  (content ?? []).map((t) => t.text).join("")

// One string per top-level block and per list item, joined by spaces: the
// same text the old read-time helper counted, so reading times do not move.
export function plainText(doc: RichTextDoc) {
  return doc.content
    .flatMap((n) => {
      if (n.type === "bulletList")
        return n.content.map((item) => inline(item.content[0].content))
      if (n.type === "blockquote")
        return n.content.map((p) => inline(p.content))
      return [inline(n.content)]
    })
    .join(" ")
}

export const readingMinutes = (value: string) =>
  Math.max(1, Math.round(value.split(/\s+/).length / 220))
