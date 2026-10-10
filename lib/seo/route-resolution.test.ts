import { describe, expect, it } from "vitest"

import { resolvePath } from "./route-resolution"

const table = {
  live: ["/", "/about", "/insights", "/insights/calm"],
  redirects: {
    "/old": { destination: "/about", statusCode: 301 },
    "/about": { destination: "/services", statusCode: 301 },
    "/legacy/deep/page.html": { destination: "/insights", statusCode: 308 },
  },
}

describe("resolvePath (Ruling R3)", () => {
  it("answers live for published pages and articles", () => {
    expect(resolvePath(table, "/about")).toEqual({ kind: "live" })
    expect(resolvePath(table, "/insights/calm")).toEqual({ kind: "live" })
  })
  it("a live path beats a redirect (Review Focus 4)", () => {
    expect(resolvePath(table, "/about")).toEqual({ kind: "live" })
  })
  it("redirects active sources at any depth", () => {
    expect(resolvePath(table, "/old")).toEqual({
      kind: "redirect",
      destination: "/about",
      statusCode: 301,
    })
    expect(resolvePath(table, "/legacy/deep/page.html")).toMatchObject({
      kind: "redirect",
      statusCode: 308,
    })
  })
  it("calls CMS-shaped unknowns missing", () => {
    expect(resolvePath(table, "/no-such-page")).toEqual({ kind: "missing" })
    expect(resolvePath(table, "/insights/nope")).toEqual({ kind: "missing" })
    expect(resolvePath(table, "/insights/__shell")).toEqual({ kind: "missing" })
  })
  it("passes everything else through to Next's router", () => {
    expect(resolvePath(table, "/newsletter/confirmed")).toEqual({
      kind: "pass",
    })
    expect(resolvePath(table, "/no/such/page")).toEqual({ kind: "pass" })
    expect(resolvePath({ live: [], redirects: {} }, "/")).toEqual({
      kind: "pass",
    })
  })
})
