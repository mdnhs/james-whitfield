// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { RichTextDoc } from "@/blocks/rich-text"

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
