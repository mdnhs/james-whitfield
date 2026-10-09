import { describe, expect, it } from "vitest"

import { safeNext } from "./safe-next"

describe("safeNext", () => {
  it("keeps admin paths", () => {
    expect(safeNext("/admin")).toBe("/admin")
    expect(safeNext("/admin/pages?tab=draft")).toBe("/admin/pages?tab=draft")
    expect(safeNext("/admin/pages#top")).toBe("/admin/pages#top")
  })

  it("falls back for anything that could leave the admin", () => {
    expect(safeNext("https://evil.example")).toBe("/admin")
    expect(safeNext("//evil.example/admin")).toBe("/admin")
    expect(safeNext("/about")).toBe("/admin")
    expect(safeNext(null)).toBe("/admin")
  })

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeNext("///evil.example")).toBe("/admin")
    expect(safeNext("/\\evil.example")).toBe("/admin")
    expect(safeNext("\\\\evil.example")).toBe("/admin")
    expect(safeNext("/admin\\..\\..\\evil")).toBe("/admin")
    expect(safeNext("/admin/x\\y")).toBe("/admin")
  })

  it("rejects schemes and non-rooted values", () => {
    expect(safeNext("javascript:alert(1)")).toBe("/admin")
    expect(safeNext("data:text/html,hi")).toBe("/admin")
    expect(safeNext("admin")).toBe("/admin")
    expect(safeNext(" /admin")).toBe("/admin")
    expect(safeNext("")).toBe("/admin")
    expect(safeNext(undefined)).toBe("/admin")
  })

  it("rejects control characters anywhere", () => {
    expect(safeNext("/admin\n")).toBe("/admin")
    expect(safeNext("/\t/evil.example")).toBe("/admin")
    expect(safeNext("/admin/\u0000")).toBe("/admin")
    expect(safeNext("/admin/\u007f")).toBe("/admin")
  })

  it("rejects look-alike prefixes and dot segments that leave the admin", () => {
    expect(safeNext("/administrator")).toBe("/admin")
    expect(safeNext("/admin/../about")).toBe("/admin")
    expect(safeNext("/admin/%2e%2e/about")).toBe("/admin")
  })

  it("uses the given fallback", () => {
    expect(safeNext("https://evil.example", "/admin/pages")).toBe(
      "/admin/pages"
    )
  })
})
