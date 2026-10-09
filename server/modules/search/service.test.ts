import { describe, expect, it } from "vitest"

import { normaliseSearch, searchNavigation } from "./service"

const hrefs = (roles: Parameters<typeof searchNavigation>[0], q: string) =>
  searchNavigation(roles, q).map((hit) => hit.href)

describe("searchNavigation", () => {
  it("lists every reachable destination for an empty query", () => {
    expect(hrefs(["intake"], "")).toEqual([
      "/admin",
      "/admin/leads",
      "/admin/help",
      "/admin/account",
    ])
  })

  it("matches labels and keywords, ignoring case and accents", () => {
    expect(hrefs(["owner"], "INVITE")).toContain("/admin/users")
    expect(hrefs(["owner"], "colours")).toContain("/admin/appearance")
    expect(normaliseSearch("Café ")).toBe("cafe")
  })

  // Review Focus #3.
  it("never offers a destination the role cannot open", () => {
    expect(hrefs(["editor"], "users")).toEqual([])
    expect(hrefs(["marketer"], "enquiries")).toEqual([])
    expect(hrefs(["admin"], "custom code")).toEqual([])
  })

  it("labels sub-pages with their section", () => {
    const hit = searchNavigation(["owner"], "redirects")[0]
    expect(hit).toEqual({
      id: "nav:seo-redirects",
      kind: "page",
      label: "SEO › Redirects",
      href: "/admin/seo/redirects",
    })
  })
})
