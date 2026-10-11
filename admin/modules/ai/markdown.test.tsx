// admin/modules/ai/markdown.test.tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

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
    expect(safeHref("mailto:hi@example.ie?subject=x")).toBeNull()
    expect(safeHref("mailto:hi@example.ie?body=Ann%20is%20anxious")).toBeNull()
    expect(safeHref("mailto:hi@example.ie?")).toBeNull()
    expect(safeHref("/api/v1/admin/leads/export")).toBeNull()
    expect(safeHref("/api/v1/admin/leads/dsar?email=a%40b.ie")).toBeNull()
    expect(safeHref("/API/v1/admin/leads/export")).toBeNull()
    expect(safeHref("/api")).toBeNull()
    expect(safeHref("/x/../api/v1/admin/leads/export")).toBeNull()
    expect(safeHref("/%61pi/v1/admin/leads/export")).toBeNull()
    expect(safeHref("/uploads/photo.jpg")).toBe("/uploads/photo.jpg")
    expect(safeHref("/apiary")).toBe("/apiary")
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

  it("draws tables with column headers in a scrollable, focusable region", () => {
    const { container } = render(
      <Markdown
        text={
          "| Page | Score |\n| :--- | ---: |\n| About | **92** |\n| Fees | 61 |\n\nAfter."
        }
      />
    )
    const region = screen.getByRole("region", { name: "Table" })
    expect(region.getAttribute("tabindex")).toBe("0")
    const heads = screen.getAllByRole("columnheader")
    expect(heads.map((h) => h.textContent)).toEqual(["Page", "Score"])
    expect(heads[0]!.getAttribute("scope")).toBe("col")
    expect(heads[1]!.className).toContain("text-right")
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(container.querySelector("tbody strong")!.textContent).toBe("92")
    expect(screen.getByText("After.").tagName).toBe("P")
  })

  it("parses table edge cases: ragged rows, escaped pipes, no table without a rule", () => {
    expect(
      parseBlocks("a | b\n--|--\n| x |\ny | z \\| w | extra\nafter")
    ).toEqual([
      {
        kind: "table",
        head: ["a", "b"],
        align: [null, null],
        rows: [
          ["x", ""],
          ["y", "z | w"],
        ],
      },
      { kind: "p", text: "after" },
    ])
    expect(parseBlocks("a | b\nc | d")).toEqual([
      { kind: "p", text: "a | b c | d" },
    ])
  })

  it("labels fenced code with its language and copies it", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    render(<Markdown text={'```json\n{ "a": 1 }\n```\n\n```\nplain\n```'} />)
    expect(screen.getByText("json")).toBeTruthy()
    expect(screen.getByText("Code")).toBeTruthy()
    expect(screen.getByRole("region", { name: "json block" }).textContent).toBe(
      '{ "a": 1 }'
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Copy json code" })
    )
    expect(writeText).toHaveBeenCalledWith('{ "a": 1 }')
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy()
  })

  it("renders quotes, rules, numbered starts and headings without adding to the outline", () => {
    const { container } = render(
      <Markdown
        text={
          "# Big\n### Small\n\n> quoted\n> on\n>\n> two\n\n---\n\n3. three\n4. four"
        }
      />
    )
    expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull()
    expect(screen.getByText("Big").tagName).toBe("P")
    const quote = container.querySelector("blockquote")!
    expect([...quote.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "quoted on",
      "two",
    ])
    expect(container.querySelector("hr")).toBeTruthy()
    expect(container.querySelector("ol")!.getAttribute("start")).toBe("3")
  })

  it("keeps the link rules inside tables and quotes", () => {
    const { container } = render(
      <Markdown
        text={
          "| Link |\n| --- |\n| [x](/api/v1/admin/leads/export) |\n\n> [y](mailto:a@b.ie?body=hi) [z](javascript:alert(1))"
        }
      />
    )
    expect(container.querySelector("a")).toBeNull()
    expect(container.textContent).toContain("x (/api/v1/admin/leads/export)")
  })
})
