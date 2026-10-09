import { describe, expect, it } from "vitest"

import {
  hasPermission,
  parseRoles,
  permissionMap,
  statement,
  type Permissions,
  type RoleName,
} from "./permissions"

const ALL: RoleName[] = [
  "owner",
  "admin",
  "editor",
  "author",
  "marketer",
  "intake",
  "viewer",
]

// Mirrors docs/brief.md §7.2. Ownership ("own") rules are enforced by the
// services; at this layer the role only needs the base permission.
const MATRIX: [Permissions, RoleName[]][] = [
  [{ dashboard: ["view"] }, ALL],
  [{ page: ["read"] }, ["owner", "admin", "editor", "author", "marketer", "viewer"]],
  [{ page: ["update"] }, ["owner", "admin", "editor"]],
  [{ page: ["publish"] }, ["owner", "admin", "editor"]],
  [{ page: ["create", "delete"] }, ["owner", "admin", "editor"]],
  [{ article: ["read"] }, ["owner", "admin", "editor", "author", "marketer", "viewer"]],
  [{ article: ["create", "update"] }, ["owner", "admin", "editor", "author"]],
  [{ article: ["publish"] }, ["owner", "admin", "editor"]],
  [{ article: ["delete"] }, ["owner", "admin", "editor", "author"]],
  [{ collection: ["read"] }, ["owner", "admin", "editor", "author", "marketer", "viewer"]],
  [{ collection: ["create", "update", "delete"] }, ["owner", "admin", "editor"]],
  [{ globals: ["read"] }, ["owner", "admin", "editor", "marketer", "viewer"]],
  [{ globals: ["update"] }, ["owner", "admin", "editor"]],
  [{ media: ["read", "upload"] }, ["owner", "admin", "editor", "author", "marketer"]],
  [{ media: ["update"] }, ["owner", "admin", "editor", "author", "marketer"]],
  [{ media: ["delete"] }, ["owner", "admin", "editor"]],
  [{ lead: ["read", "update"] }, ["owner", "admin", "intake"]],
  [{ lead: ["export"] }, ["owner", "admin"]],
  [{ lead: ["delete"] }, ["owner", "admin"]],
  [{ newsletter: ["read", "export"] }, ["owner", "admin", "marketer"]],
  [{ newsletter: ["delete"] }, ["owner", "admin"]],
  [{ seo: ["read"] }, ["owner", "admin", "editor", "marketer", "viewer"]],
  [{ seo: ["update"] }, ["owner", "admin", "editor", "marketer"]],
  [{ redirect: ["read", "manage"] }, ["owner", "admin", "editor", "marketer"]],
  [{ tracking: ["read", "update"] }, ["owner", "admin", "marketer"]],
  [{ code: ["update"] }, ["owner"]],
  [{ appearance: ["read", "update", "publish"] }, ["owner", "admin"]],
  [{ settings: ["read", "update"] }, ["owner", "admin"]],
  [{ audit: ["read"] }, ["owner", "admin"]],
  [{ user: ["create", "list", "set-role", "ban"] }, ["owner", "admin"]],
  [{ session: ["list", "revoke"] }, ["owner", "admin"]],
  [{ user: ["impersonate"] }, ["owner", "admin"]],
  [{ user: ["impersonate-admins"] }, ["owner"]],
]

describe("permission matrix (brief §7.2)", () => {
  for (const [permission, allowed] of MATRIX) {
    for (const role of ALL) {
      const expected = allowed.includes(role)
      it(`${role} ${expected ? "can" : "cannot"} ${JSON.stringify(permission)}`, () => {
        expect(hasPermission([role], permission)).toBe(expected)
      })
    }
  }
})

describe("users with several roles", () => {
  it("are allowed when any one role grants the permission", () => {
    expect(hasPermission(["intake", "marketer"], { lead: ["read"] })).toBe(true)
    expect(hasPermission(["intake", "marketer"], { tracking: ["update"] })).toBe(true)
  })

  it("need one role that covers every resource of a single check", () => {
    // Same semantics as Better Auth: resources inside one check are ANDed.
    expect(
      hasPermission(["intake", "marketer"], { lead: ["read"], tracking: ["update"] })
    ).toBe(false)
  })
})

describe("parseRoles", () => {
  it("splits Better Auth's comma-separated role column and drops unknown roles", () => {
    expect(parseRoles("editor, author,ghost")).toEqual(["editor", "author"])
    expect(parseRoles(null)).toEqual([])
  })

  it("never treats prototype keys as roles", () => {
    expect(parseRoles("constructor")).toEqual([])
    expect(parseRoles("toString,editor")).toEqual(["editor"])
    expect(parseRoles("__proto__,hasOwnProperty,viewer")).toEqual(["viewer"])
  })

  it("keeps hasPermission safe on prototype-key input", () => {
    const parsed = parseRoles("constructor,toString,__proto__")
    expect(() => hasPermission(parsed, { page: ["read"] })).not.toThrow()
    expect(hasPermission(parsed, { page: ["read"] })).toBe(false)
  })
})

describe("owner role", () => {
  it("holds every action of every statement resource", () => {
    for (const [resource, actions] of Object.entries(statement)) {
      expect(
        hasPermission(["owner"], { [resource]: [...actions] } as Permissions)
      ).toBe(true)
    }
  })
})

describe("permissionMap", () => {
  it("unions the actions of every role a user holds", () => {
    const map = permissionMap(["intake", "viewer"])
    expect(map.lead).toEqual(["read", "update"])
    expect(map.page).toEqual(["read"])
    expect(map.code ?? []).toEqual([])
  })
})
