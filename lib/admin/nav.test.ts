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

describe("visibleNav (docs/brief.md §7.2, §9.1)", () => {
  it("shows intake only the dashboard and enquiries", () => {
    expect(ids("intake")).toEqual(["dashboard", "leads"])
  })

  it("shows a viewer read-only content sections and no settings", () => {
    expect(ids("viewer")).toEqual([
      "dashboard",
      "pages",
      "insights",
      "collections",
      "seo",
    ])
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
    ])
    const marketing = visibleNav(["marketer"]).find(
      (item) => item.id === "marketing"
    )
    expect(marketing?.children?.map((child) => child.id)).toEqual([
      "marketing-tracking",
      "marketing-consent",
    ])
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
