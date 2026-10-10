import { describe, expect, it } from "vitest"

import { permissionMatrix } from "./matrix"
import { ROLE_NAMES, statement } from "./permissions"

const cell = (resource: string, action: string, role: string) =>
  permissionMatrix().find(
    (r) => r.resource === resource && r.action === action
  )!.cells[role as never]

describe("permissionMatrix (docs/brief.md §7.2)", () => {
  it("has one row per statement action and a cell per role", () => {
    const rows = permissionMatrix()
    const expected = Object.values(statement).reduce((n, a) => n + a.length, 0)
    expect(rows).toHaveLength(expected)
    for (const row of rows)
      expect(Object.keys(row.cells).sort()).toEqual([...ROLE_NAMES].sort())
  })

  it("matches the brief's table at its tricky cells", () => {
    expect(cell("code", "update", "owner")).toBe("yes")
    expect(cell("code", "update", "admin")).toBe("no")
    expect(cell("user", "impersonate-admins", "admin")).toBe("no")
    expect(cell("user", "impersonate", "admin")).toBe("not-owners")
    expect(cell("session", "revoke", "admin")).toBe("not-owners")
    expect(cell("article", "update", "author")).toBe("own")
    expect(cell("article", "publish", "author")).toBe("no")
    expect(cell("media", "update", "author")).toBe("own")
    expect(cell("lead", "read", "marketer")).toBe("no")
    expect(cell("lead", "read", "intake")).toBe("yes")
    expect(cell("globals", "update", "viewer")).toBe("no")
    expect(cell("audit", "read", "admin")).toBe("yes")
  })
})
