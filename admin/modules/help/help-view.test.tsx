// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { helpArticle, tocFor } from "@/lib/admin/help/registry"

import {
  buildRail,
  currentHeading,
  highlightDash,
  HelpToc,
  RAIL_X,
} from "./help-toc"
import { HelpArticleView, HelpOverview, HelpShell } from "./help-view"

const pathname = vi.hoisted(() => ({ current: "/admin/help" }))
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }))

const navLinks = (name: string) =>
  within(screen.getByRole("navigation", { name }))
    .getAllByRole("link")
    .map((link) => link.textContent)

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
}

beforeEach(() => mockReducedMotion(false))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("help article page", () => {
  it("renders the topics sidebar, the article and its table of contents", () => {
    const article = helpArticle("media")!
    pathname.current = "/admin/help/media"
    render(
      <HelpShell roles={["owner"]}>
        <HelpArticleView article={article} roles={["owner"]} />
      </HelpShell>
    )

    expect(navLinks("Help topics")).toContain("The Media library")
    // The current article, read from the URL, is marked in the topics.
    expect(
      within(screen.getByRole("navigation", { name: "Help topics" }))
        .getByRole("link", { name: "The Media library" })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("heading", { level: 1, name: "The Media library" })
    ).toBeDefined()

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(article.sections.map((section) => section.title))

    // The TOC is built from the headings and points at their anchors.
    const toc = within(screen.getByRole("navigation", { name: "On this page" }))
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")])
    expect(toc).toEqual(tocFor(article).map((e) => [e.title, `#${e.id}`]))
    for (const [, href] of toc)
      expect(document.getElementById(href!.slice(1))).not.toBeNull()

    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeDefined()
    expect(screen.getAllByRole("note").length).toBeGreaterThan(0)
  })

  it("renders sub-sections as h3 and indents them in the TOC", () => {
    const article = helpArticle("site-settings")!
    render(<HelpArticleView article={article} roles={["owner"]} />)
    const h3s = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent)
    expect(h3s).toEqual(
      article.sections.filter((s) => s.level === 3).map((s) => s.title)
    )
    const levels = within(
      screen.getByRole("navigation", { name: "On this page" })
    )
      .getAllByRole("link")
      .map((link) => link.getAttribute("data-level"))
    expect(levels).toEqual(tocFor(article).map((e) => String(e.level)))
    expect(levels).toContain("3")
  })

  it("pages to the neighbours in sidebar order, named by their titles", () => {
    render(
      <HelpArticleView article={helpArticle("media")!} roles={["owner"]} />
    )
    const pager = screen.getByRole("navigation", { name: "Pagination" })
    const prev = within(pager).getByRole("link", {
      name: "Previous Categories and authors",
    })
    const next = within(pager).getByRole("link", { name: "Next Enquiries" })
    expect(prev.getAttribute("href")).toBe(
      "/admin/help/insights-categories-authors"
    )
    expect(next.getAttribute("href")).toBe("/admin/help/enquiries")
    // No group label in the pager.
    expect(pager.textContent).not.toContain("Enquiries & chat")
  })

  it("keeps a spacer where there is no previous article", () => {
    render(
      <HelpArticleView
        article={helpArticle("getting-started")!}
        roles={["owner"]}
      />
    )
    const pager = screen.getByRole("navigation", { name: "Pagination" })
    expect(within(pager).getAllByRole("link")).toHaveLength(1)
    expect(pager.firstElementChild?.getAttribute("aria-hidden")).toBe("true")
  })

  it("does not link a role to screens it cannot open", () => {
    pathname.current = "/admin/help/getting-started"
    render(
      <HelpShell roles={["intake"]}>
        <HelpArticleView
          article={helpArticle("getting-started")!}
          roles={["intake"]}
        />
      </HelpShell>
    )
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
    expect(hrefs).not.toContain("/admin/users")
    expect(hrefs).not.toContain("/admin/help/website-pages")
    // The label still reads as text.
    expect(screen.getAllByText(/Pages and the page builder/).length).toBe(1)
    expect(navLinks("Help topics")).not.toContain("Pages and the page builder")
    expect(navLinks("Help topics")).toContain("Enquiries")
  })
})

describe("help overview", () => {
  it("lists only the groups a role can read", () => {
    render(<HelpOverview roles={["intake"]} />)
    const groups = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(groups).toContain("Enquiries & chat")
    expect(groups).not.toContain("Website")
    expect(
      screen.getByRole("link", { name: /New here\?/ }).getAttribute("href")
    ).toBe("/admin/help/getting-started")
  })
})

describe("currentHeading", () => {
  const entries = [
    { id: "a", title: "A", level: 2 as const },
    { id: "b", title: "B", level: 2 as const },
    { id: "c", title: "C", level: 2 as const },
  ]

  it("starts on the first section", () => {
    expect(currentHeading(entries, () => 500)).toBe("a")
  })

  it("follows the last heading scrolled past the reading line", () => {
    const tops: Record<string, number> = { a: -400, b: 60, c: 600 }
    expect(currentHeading(entries, (id) => tops[id])).toBe("b")
  })

  it("lands on the last section at the end of the page", () => {
    const tops: Record<string, number> = { a: -400, b: 60, c: 600 }
    expect(currentHeading(entries, (id) => tops[id], true)).toBe("c")
  })
})

describe("TOC rail", () => {
  // h2, h3, h3, h2: the rail steps in, runs down, steps back out.
  const items = [
    { top: 0, height: 28, level: 2 as const },
    { top: 28, height: 28, level: 3 as const },
    { top: 56, height: 28, level: 3 as const },
    { top: 84, height: 28, level: 2 as const },
  ]

  it("builds one straight run per heading, bending between levels", () => {
    const rail = buildRail(items)
    expect(rail.segments).toHaveLength(items.length)
    expect(rail.d.startsWith(`M${RAIL_X[2]} 0`)).toBe(true)
    expect(rail.d).toContain(`L${RAIL_X[3]} `)
    // The bends are diagonals, so the path is longer than the list is tall.
    expect(rail.total).toBeGreaterThan(rail.height)
    expect(rail.height).toBe(112)
    // Runs follow one another along the path.
    for (let i = 1; i < rail.segments.length; i++) {
      const prev = rail.segments[i - 1]!
      expect(rail.segments[i]!.start).toBeGreaterThanOrEqual(
        prev.start + prev.length
      )
    }
  })

  it("draws the accent as one dash over the active heading's run", () => {
    const rail = buildRail(items)
    const dash = highlightDash(rail, 2)
    expect(dash.dashoffset).toBe(-rail.segments[2]!.start)
    expect(dash.dasharray.split(" ")[0]).toBe(String(rail.segments[2]!.length))
  })

  it("is empty for no headings", () => {
    expect(buildRail([])).toEqual({ d: "", segments: [], total: 0, height: 0 })
  })
})

describe("HelpToc", () => {
  const entries = [
    { id: "one", title: "One", level: 2 as const },
    { id: "two", title: "Two", level: 3 as const },
    { id: "three", title: "Three", level: 2 as const },
  ]

  function renderToc() {
    render(
      <>
        {entries.map((entry) => (
          <h2 key={entry.id} id={entry.id}>
            {entry.title}
          </h2>
        ))}
        <HelpToc entries={entries} />
      </>
    )
    return within(screen.getByRole("navigation", { name: "On this page" }))
  }

  it("marks the active heading with aria-current, following clicks", async () => {
    const toc = renderToc()
    const link = (name: string) => toc.getByRole("link", { name })
    await userEvent.click(link("One"))
    expect(link("One").getAttribute("aria-current")).toBe("location")
    expect(link("Three").getAttribute("aria-current")).toBeNull()
    await userEvent.click(link("Three"))
    expect(link("Three").getAttribute("aria-current")).toBe("location")
    expect(link("One").getAttribute("aria-current")).toBeNull()
  })

  it("slides the accent with a transition", () => {
    renderToc()
    const active = screen.getByTestId("toc-active")
    expect(active.style.transition).toContain("stroke-dashoffset")
    expect(active.hasAttribute("data-reduced-motion")).toBe(false)
  })

  it("switches instantly when the viewer prefers reduced motion", () => {
    mockReducedMotion(true)
    renderToc()
    const active = screen.getByTestId("toc-active")
    expect(active.style.transition).toBe("none")
    expect(active.hasAttribute("data-reduced-motion")).toBe(true)
  })
})
