// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  filterGroups,
  HelpSidebar,
  OPEN_GROUPS_KEY,
  type HelpNavGroup,
} from "./help-sidebar"

const GROUPS: HelpNavGroup[] = [
  {
    id: "start",
    label: "Getting started",
    articles: [
      { slug: "getting-started", title: "Getting started" },
      { slug: "roles", title: "Roles and permissions" },
    ],
  },
  {
    id: "content",
    label: "Insights & media",
    articles: [{ slug: "media", title: "The Media library" }],
  },
  {
    id: "inbox",
    label: "Enquiries & chat",
    articles: [{ slug: "enquiries", title: "Enquiries" }],
  },
]

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

const header = (name: string) => screen.getByRole("button", { name })
const expanded = (name: string) => header(name).getAttribute("aria-expanded")

beforeEach(() => {
  window.localStorage.clear()
  mockReducedMotion(false)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("HelpSidebar", () => {
  it("opens the current article's group and highlights the article", () => {
    render(<HelpSidebar groups={GROUPS} active="media" />)
    expect(expanded("Insights & media")).toBe("true")
    expect(expanded("Getting started")).toBe("false")
    expect(expanded("Enquiries & chat")).toBe("false")
    const current = screen.getByRole("link", { name: "The Media library" })
    expect(current.getAttribute("aria-current")).toBe("page")
    expect(current.className).toContain("border-primary")
  })

  it("ties each header to its panel with aria-controls", () => {
    render(<HelpSidebar groups={GROUPS} active="media" />)
    const panelId = header("Insights & media").getAttribute("aria-controls")!
    const panel = document.getElementById(panelId)!
    expect(panel.getAttribute("data-state")).toBe("open")
    expect(
      within(panel).getByRole("link", { name: "The Media library" })
    ).toBeDefined()
  })

  it("toggles groups by click and keyboard, several open at once", async () => {
    const user = userEvent.setup()
    render(<HelpSidebar groups={GROUPS} active="media" />)
    await user.click(header("Getting started"))
    expect(expanded("Getting started")).toBe("true")
    expect(expanded("Insights & media")).toBe("true")

    header("Enquiries & chat").focus()
    await user.keyboard("{Enter}")
    expect(expanded("Enquiries & chat")).toBe("true")
    await user.keyboard(" ")
    expect(expanded("Enquiries & chat")).toBe("false")

    const panel = document.getElementById(
      header("Enquiries & chat").getAttribute("aria-controls")!
    )!
    expect(panel.getAttribute("data-state")).toBe("closed")
    expect(panel.hasAttribute("inert")).toBe(true)
  })

  it("remembers open groups in localStorage", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<HelpSidebar groups={GROUPS} active={null} />)
    await user.click(header("Enquiries & chat"))
    expect(JSON.parse(window.localStorage.getItem(OPEN_GROUPS_KEY)!)).toEqual([
      "inbox",
    ])
    unmount()
    render(<HelpSidebar groups={GROUPS} active={null} />)
    expect(expanded("Enquiries & chat")).toBe("true")
    expect(expanded("Getting started")).toBe("false")
  })

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    render(<HelpSidebar groups={GROUPS} active="media" />)
    expect(expanded("Insights & media")).toBe("true")
    vi.restoreAllMocks()
  })

  it("filters titles and expands every matching group", async () => {
    const user = userEvent.setup()
    render(<HelpSidebar groups={GROUPS} active={null} />)
    await user.type(
      screen.getByRole("searchbox", { name: "Filter help topics" }),
      "media"
    )
    expect(expanded("Insights & media")).toBe("true")
    expect(screen.queryByRole("button", { name: "Getting started" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Enquiries & chat" })
    ).toBeNull()

    await user.clear(screen.getByRole("searchbox"))
    await user.type(screen.getByRole("searchbox"), "zzz")
    expect(screen.getByText("No topics match.")).toBeDefined()
  })

  it("animates the panels unless the viewer prefers reduced motion", () => {
    render(<HelpSidebar groups={GROUPS} active="media" />)
    const panel = screen.getByTestId("help-group-content")
    expect(panel.className).toContain("transition-[grid-template-rows]")
    cleanup()

    mockReducedMotion(true)
    render(<HelpSidebar groups={GROUPS} active="media" />)
    expect(screen.getByTestId("help-group-content").className).not.toContain(
      "transition"
    )
  })
})

describe("filterGroups", () => {
  it("keeps only matching articles and their groups", () => {
    expect(filterGroups(GROUPS, "ROLES")).toEqual([
      {
        ...GROUPS[0],
        articles: [{ slug: "roles", title: "Roles and permissions" }],
      },
    ])
    expect(filterGroups(GROUPS, " ")).toEqual(GROUPS)
  })
})

describe("activeHelpSlug", () => {
  it("reads the article from the path; the overview has none", async () => {
    const { activeHelpSlug } = await import("./help-sidebar")
    expect(activeHelpSlug("/admin/help")).toBeNull()
    expect(activeHelpSlug("/admin/help/")).toBeNull()
    expect(activeHelpSlug("/admin/help/media")).toBe("media")
    expect(activeHelpSlug(null)).toBeNull()
  })
})
