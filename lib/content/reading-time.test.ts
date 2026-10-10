import { describe, expect, it } from "vitest"

// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- test reads the seed fixtures
import { ARTICLE_BODIES } from "@/server/db/seed/fixtures/article-bodies"
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- test compares against the seed helper
import { toTipTap } from "@/server/db/seed/tiptap"

import { plainText, readingMinutes } from "./reading-time"

// The Phase 3 helper, frozen here: the new walker must count the same words.
const inline = (c?: { text: string }[]) => (c ?? []).map((t) => t.text).join("")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacy = (doc: any): string =>
  doc.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .flatMap((n: any) =>
      n.type === "bulletList"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          n.content.map((i: any) => inline(i.content[0].content))
        : n.type === "blockquote"
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            n.content.map((p: any) => inline(p.content))
          : [inline(n.content)]
    )
    .join(" ")

describe("plainText", () => {
  it.each(Object.keys(ARTICLE_BODIES))(
    "matches the seed's count for %s",
    (slug) => {
      const doc = toTipTap(ARTICLE_BODIES[slug]!)
      expect(plainText(doc)).toBe(legacy(doc))
      expect(readingMinutes(plainText(doc))).toBe(readingMinutes(legacy(doc)))
    }
  )
  it("tolerates half-typed drafts and images", () => {
    expect(
      plainText({
        type: "doc",
        content: [
          { type: "image", attrs: { mediaId: "x" } },
          { type: "paragraph" },
          { type: "heading", content: [{ type: "text", text: "Hi" }] },
        ],
      })
    ).toBe(" Hi")
    expect(plainText(null)).toBe("")
    expect(readingMinutes("")).toBe(1)
  })
})
