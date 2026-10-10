// admin/modules/ai/markdown.test.tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Markdown, parseBlocks, safeHref } from "./markdown"

describe("Markdown (no raw HTML, ever)", () => {
  it("renders the supported subset", () => {
    const { container } = render(
      <Markdown
        text={
          "## Title\n\nSome **bold** and *soft* `code`.\n\n- one\n- two\n\n1. first\n\n```\nconst a = 1\n```"
        }
      />
    )
    expect(screen.getByText("Title").tagName).toBe("P")
    expect(container.querySelector("strong")!.textContent).toBe("bold")
    expect(container.querySelector("em")!.textContent).toBe("soft")
    expect(container.querySelectorAll("ul li")).toHaveLength(2)
    expect(container.querySelectorAll("ol li")).toHaveLength(1)
    expect(container.querySelector("pre code")!.textContent).toBe("const a = 1")
  })

  it("shows HTML and script as text", () => {
    const { container } = render(
      <Markdown
        text={'<img src=x onerror="alert(1)"><script>alert(2)</script>'}
      />
    )
    expect(container.querySelector("img, script")).toBeNull()
    expect(container.textContent).toContain("<script>alert(2)</script>")
  })

  it("links only safe URLs", () => {
    const { container } = render(
      <Markdown
        text={
          "[ok](https://example.ie/a) [bad](javascript:alert(1)) [rel](/admin/pages)"
        }
      />
    )
    const links = [...container.querySelectorAll("a")]
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.ie/a",
      "/admin/pages",
    ])
    expect(links[0]!.getAttribute("rel")).toContain("noopener")
    expect(container.textContent).toContain("bad (javascript:alert(1))")
    expect(safeHref("//evil.example")).toBeNull()
    expect(safeHref("data:text/html,x")).toBeNull()
    expect(safeHref("http://plain.example")).toBeNull()
    expect(safeHref("/\\evil.example")).toBeNull()
    expect(safeHref("mailto:hi@example.ie")).toBe("mailto:hi@example.ie")
    // Same-site links stay in this tab; external ones open a new one.
    expect(links[0]!.getAttribute("target")).toBe("_blank")
    expect(links[0]!.getAttribute("rel")).toBe("noopener noreferrer nofollow")
    expect(links[1]!.getAttribute("target")).toBeNull()
  })

  it("groups list lines and joins paragraph lines", () => {
    expect(parseBlocks("a\nb\n\n- x\n- y")).toEqual([
      { kind: "p", text: "a b" },
      { kind: "ul", items: ["x", "y"] },
    ])
  })
})
