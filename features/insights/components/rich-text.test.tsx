// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ArticleBodyDoc, RichTextDoc } from "@/blocks/rich-text"
import type { MediaAsset } from "@/lib/media"

import { RichText } from "./rich-text"

const doc = (
  marks: unknown[],
  value = "<img src=x onerror=alert(1)>"
): RichTextDoc =>
  ({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Lead" }] },
      {
        type: "paragraph",
        content: [{ type: "text", text: value, marks }],
      },
    ],
  }) as RichTextDoc

describe("RichText", () => {
  it("escapes text instead of parsing it as HTML", () => {
    const { container } = render(<RichText doc={doc([])} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>")
  })

  it("links safe hrefs", () => {
    const { container } = render(
      <RichText
        doc={doc([{ type: "link", attrs: { href: "/contact" } }], "talk")}
      />
    )
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/contact")
  })

  it.each([
    "javascript:alert(1)",
    "//evil.example",
    "/\\evil.example",
    "data:text/html,x",
  ])("drops the link for unsafe href %s", (href) => {
    const { container } = render(
      <RichText doc={doc([{ type: "link", attrs: { href } }], "talk")} />
    )
    expect(container.querySelector("a")).toBeNull()
    expect(container.textContent).toContain("talk")
  })

  it("renders a link mark without attrs as plain text", () => {
    const { container } = render(
      <RichText doc={doc([{ type: "link" }], "talk")} />
    )
    expect(container.querySelector("a")).toBeNull()
    expect(container.textContent).toContain("talk")
  })

  it("renders headings, blockquotes and bullet lists with their markup", () => {
    const text = (value: string) => [{ type: "text", text: value }]
    const { container } = render(
      <RichText
        doc={
          {
            type: "doc",
            content: [
              { type: "paragraph", content: text("Lead") },
              {
                type: "heading",
                attrs: { level: 2 },
                content: text("Title"),
              },
              {
                type: "blockquote",
                content: [{ type: "paragraph", content: text("Quote") }],
              },
              {
                type: "bulletList",
                content: ["One", "Two"].map((v) => ({
                  type: "listItem",
                  content: [{ type: "paragraph", content: text(v) }],
                })),
              },
            ],
          } as RichTextDoc
        }
      />
    )
    expect(container.querySelector("h2")?.textContent).toBe("Title")
    expect(container.querySelector("blockquote p")?.textContent).toBe("Quote")
    const items = [...container.querySelectorAll("ul > li")]
    expect(items.map((li) => li.textContent)).toEqual(["One", "Two"])
    expect(items[0].querySelector("span[aria-hidden]")).not.toBeNull()
  })

  it("renders the first paragraph as the lead and bold marks as strong", () => {
    const { container } = render(
      <RichText doc={doc([{ type: "bold" }], "Bold.")} />
    )
    expect(container.querySelector("p")?.getAttribute("data-motion")).toBe(
      "words"
    )
    expect(container.querySelector("strong")?.textContent).toBe("Bold.")
  })
})

const ASSET_ID = "00000000-0000-4000-8000-0000000000aa"
const asset: MediaAsset = {
  id: ASSET_ID,
  src: "/images/hero/hero-bg.png",
  width: 800,
  height: 600,
  blurDataURL: null,
  alt: "A calm room",
  focal: { x: 0.5, y: 0.5 },
}
const withImage = (mediaId: string): ArticleBodyDoc => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Lead" }] },
    { type: "image", attrs: { mediaId, src: "/stale.png", alt: "stale" } },
  ],
})

describe("RichText article extras", () => {
  it("renders body images from the library asset, not the stored src", () => {
    const { container } = render(
      <RichText doc={withImage(ASSET_ID)} media={[asset]} />
    )
    const img = container.querySelector("figure img")
    expect(img?.getAttribute("alt")).toBe("A calm room")
    expect(img?.getAttribute("src")).toContain(
      encodeURIComponent("/images/hero/hero-bg.png")
    )
  })
  it("drops an image whose asset is gone instead of failing the article", () => {
    const { container } = render(
      <RichText doc={withImage(ASSET_ID)} media={[]} />
    )
    expect(container.querySelector("figure")).toBeNull()
    expect(container.textContent).toContain("Lead")
  })
  it("renders level-3 headings as h3", () => {
    const { container } = render(
      <RichText
        doc={
          {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 3 },
                content: [{ type: "text", text: "Small" }],
              },
            ],
          } as RichTextDoc
        }
      />
    )
    expect(container.querySelector("h3")?.textContent).toBe("Small")
  })
  it("skips node types the schema does not know instead of failing the article", () => {
    const { container } = render(
      <RichText
        doc={
          {
            type: "doc",
            content: [
              { type: "video" },
              {
                type: "paragraph",
                content: [{ type: "text", text: "Still here" }],
              },
            ],
          } as unknown as RichTextDoc
        }
      />
    )
    expect(container.querySelector("video")).toBeNull()
    expect(container.textContent).toBe("Still here")
  })
})
