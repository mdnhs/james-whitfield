// server/modules/ai/flatten.test.ts
import { describe, expect, it } from "vitest"

import { clip, flattenBlocks } from "./flatten"

describe("flattenBlocks", () => {
  it("keeps readable text and skips ids, media and links", () => {
    const doc = {
      blocks: [
        {
          id: "b1",
          type: "hero.page",
          anchor: "home",
          chapter: "Welcome",
          data: {
            title: "Calm, close to home",
            image: { mediaId: "7b0b0f7e-0000-4000-8000-000000000000" },
            href: "https://x.ie",
            tint: 0.3,
          },
        },
        {
          id: "b2",
          type: "about.body",
          data: {
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Hello there." }],
                },
              ],
            },
          },
        },
      ],
    }
    const { text } = flattenBlocks(doc)
    expect(text).toContain("Welcome")
    expect(text).toContain("Calm, close to home")
    expect(text).toContain("Hello there.")
    // "home" may appear in prose ("close to home"), never as the bare anchor.
    expect(text).not.toMatch(/7b0b0f7e|https|hero\.page|^home$/m)
  })

  it("clips at the limit and says so", () => {
    expect(clip("x".repeat(9000))).toEqual({
      text: "x".repeat(8000),
      truncated: true,
    })
    expect(clip("short")).toEqual({ text: "short", truncated: false })
  })

  it("tolerates junk", () => {
    expect(flattenBlocks(null).text).toBe("")
    expect(flattenBlocks({ blocks: "nope" }).text).toBe("")
  })
})
