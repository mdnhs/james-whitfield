import { describe, expect, it } from "vitest"

import {
  hasPermission,
  ROLE_NAMES,
  type RoleName,
} from "@/lib/auth/permissions"

import {
  EXTRA_LINKS,
  HELP_LINK,
  isActivePath,
  linkForPath,
  NAV,
  permissionFor,
  reachableLinks,
  visibleNav,
} from "./nav"

const ids = (role: RoleName) => visibleNav([role]).map((item) => item.id)

const childIds = (role: RoleName, section: string) =>
  visibleNav([role])
    .find((item) => item.id === section)
    ?.children?.map((child) => child.id)

// The content globals (docs/brief.md §6.4, §7.2): globals.read, not
// settings.read, so editors, marketers and viewers reach them.
const GLOBALS_PAGES = [
  "settings-contact",
  "settings-navigation",
  "settings-footer",
  "settings-forms",
]

describe("visibleNav (docs/brief.md §7.2, §9.1)", () => {
  it("shows intake only the dashboard and enquiries", () => {
    expect(ids("intake")).toEqual(["dashboard", "leads"])
  })

  it("shows a viewer read-only content sections and only the globals", () => {
    expect(ids("viewer")).toEqual([
      "dashboard",
      "pages",
      "insights",
      "collections",
      "seo",
      "settings",
    ])
    expect(childIds("viewer", "settings")).toEqual(GLOBALS_PAGES)
    const seo = visibleNav(["viewer"]).find((item) => item.id === "seo")
    expect(seo?.children?.map((child) => child.id)).toEqual([
      "seo-overview",
      "seo-defaults",
    ])
  })

  it("keeps enquiries away from a marketer", () => {
    expect(ids("marketer")).toEqual([
      "dashboard",
      "pages",
      "insights",
      "collections",
      "media",
      "newsletter",
      "seo",
      "marketing",
      "settings",
    ])
    expect(childIds("marketer", "settings")).toEqual(GLOBALS_PAGES)
    const marketing = visibleNav(["marketer"]).find(
      (item) => item.id === "marketing"
    )
    expect(marketing?.children?.map((child) => child.id)).toEqual([
      "marketing-tracking",
      "marketing-consent",
    ])
  })

  it("gives an editor the globals but not the site frame", () => {
    expect(ids("editor")).toContain("settings")
    expect(childIds("editor", "settings")).toEqual(GLOBALS_PAGES)
  })

  it("keeps author and intake out of site settings", () => {
    expect(ids("author")).not.toContain("settings")
    expect(ids("intake")).not.toContain("settings")
  })

  it("shows an owner everything, and an admin everything but custom code", () => {
    expect(ids("owner")).toEqual(NAV.map((item) => item.id))
    const marketing = visibleNav(["admin"]).find(
      (item) => item.id === "marketing"
    )
    expect(marketing?.children?.map((child) => child.id)).not.toContain(
      "marketing-code"
    )
  })

  // The Site settings section is gated on globals.read as the weaker of its
  // children's gates; that only holds while settings.read implies it.
  it.each(ROLE_NAMES)("%s: settings.read implies globals.read", (role) => {
    if (hasPermission([role], { settings: ["read"] })) {
      expect(hasPermission([role], { globals: ["read"] })).toBe(true)
    }
  })

  it("merges several roles", () => {
    expect(visibleNav(["intake", "marketer"]).map((item) => item.id)).toContain(
      "leads"
    )
  })
})

// Review Focus #1: the sidebar, ⌘K and the page guard share one source, so
// what is listed is exactly what opens.
describe.each(ROLE_NAMES)("%s: listing and guard agree", (role) => {
  const listed = new Set(reachableLinks([role]).map((link) => link.href))
  const everyHref = [
    ...NAV.flatMap((item) => [item, ...(item.children ?? [])]),
    HELP_LINK,
    ...EXTRA_LINKS,
  ].map((link) => link.href)

  it.each(everyHref)("%s", (href) => {
    const guard = linkForPath(href)
    expect(guard).toBeDefined()
    expect(listed.has(href)).toBe(hasPermission([role], guard!.permission))
  })
})

describe("reachableLinks", () => {
  it("lists each destination once, with its section", () => {
    const links = reachableLinks(["owner"])
    expect(new Set(links.map((link) => link.href)).size).toBe(links.length)
    expect(links.find((link) => link.id === "seo-redirects")?.parent).toBe(
      "SEO"
    )
    expect(links.find((link) => link.id === "dashboard")?.parent).toBeNull()
  })

  it("includes Help and Account for everyone, Design only for owners", () => {
    const intake = reachableLinks(["intake"]).map((link) => link.id)
    expect(intake).toEqual(
      expect.arrayContaining(["dashboard", "leads", "help", "account"])
    )
    expect(intake).not.toContain("design")
    expect(reachableLinks(["owner"]).map((link) => link.id)).toContain("design")
  })
})

describe("linkForPath", () => {
  it("matches hrefs exactly", () => {
    expect(linkForPath("/admin/seo/redirects")?.id).toBe("seo-redirects")
    expect(linkForPath("/admin/seo/redirects/123")).toBeUndefined()
    expect(linkForPath("/admin/nope")).toBeUndefined()
  })
})

describe("isActivePath", () => {
  it("highlights the dashboard only on /admin", () => {
    expect(isActivePath("/admin", "/admin")).toBe(true)
    expect(isActivePath("/admin/pages", "/admin")).toBe(false)
  })

  it("highlights a section on its sub-pages, not on look-alikes", () => {
    expect(isActivePath("/admin/seo/defaults", "/admin/seo")).toBe(true)
    expect(isActivePath("/admin/seo-tools", "/admin/seo")).toBe(false)
  })
})

// Real pages read their gate from here instead of restating it, so a page and
// its sidebar link cannot disagree (Review Focus #1).
describe("permissionFor", () => {
  it("returns the registry permission for a destination", () => {
    expect(permissionFor("/admin/seo/redirects")).toEqual({
      redirect: ["read"],
    })
    expect(permissionFor("/admin/design")).toEqual({ code: ["update"] })
  })

  it("throws for a path the registry does not know", () => {
    expect(() => permissionFor("/admin/nope")).toThrow(/\/admin\/nope/)
  })
})
