import { describe, expect, it } from "vitest"

import { ArticleBodyDoc, RichTextDoc } from "@/blocks/rich-text"

import {
  ArticleContent,
  ArticleDraft,
  EMPTY_BODY,
  UnpublishInput,
} from "./article"

const id = "00000000-0000-4000-8000-000000000001"
const valid = {
  title: "Calm",
  slug: "calm",
  excerpt: "Short.",
  cover: { mediaId: id },
  categoryId: id,
  authorId: id,
  featured: false,
  body: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
  },
}
const image = {
  type: "image",
  attrs: { mediaId: id, src: "/x.png", alt: "", title: null, width: null },
}

describe("article schemas", () => {
  it("accepts a complete article and strips editor-only image attrs", () => {
    const body = { type: "doc", content: [image] }
    const parsed = ArticleContent.parse({ ...valid, body })
    expect(parsed.body.content[0]).toEqual({
      type: "image",
      attrs: { mediaId: id, src: "/x.png", alt: "" },
    })
  })
  it("keeps images out of page rich text", () => {
    expect(
      RichTextDoc.safeParse({ type: "doc", content: [image] }).success
    ).toBe(false)
    expect(
      ArticleBodyDoc.safeParse({ type: "doc", content: [image] }).success
    ).toBe(true)
  })
  it.each([
    ["slug", "Not A Slug"],
    ["slug", "__shell"],
    ["excerpt", ""],
    ["cover", null],
    ["title", " "],
  ])("rejects %s = %j on publish", (key, value) => {
    expect(ArticleContent.safeParse({ ...valid, [key]: value }).success).toBe(
      false
    )
  })
  it("lets a draft be half-finished", () => {
    expect(
      ArticleDraft.safeParse({
        title: "",
        slug: "",
        excerpt: "",
        cover: null,
        categoryId: null,
        authorId: null,
        featured: false,
        body: EMPTY_BODY,
      }).success
    ).toBe(true)
  })
  it("only redirects to /insights or another article", () => {
    expect(
      UnpublishInput.safeParse({ version: 1, redirectTo: "/insights" }).success
    ).toBe(true)
    expect(
      UnpublishInput.safeParse({
        version: 1,
        redirectTo: "/insights/other-one",
      }).success
    ).toBe(true)
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/about",
      "/insights/../x",
    ])
      expect(
        UnpublishInput.safeParse({ version: 1, redirectTo: bad }).success
      ).toBe(false)
  })
})
