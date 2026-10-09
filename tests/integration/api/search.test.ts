import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  ROLE_NAMES,
  hasPermission,
  type RoleName,
} from "@/lib/auth/permissions"
import { EXTRA_LINKS, HELP_LINK, NAV, type NavLink } from "@/lib/admin/nav"
import { closeDb } from "@/server/db/client"

import {
  adminRequest,
  createUser,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

async function search(cookie: string, q: string) {
  const response = await adminRequest(
    `/search?q=${encodeURIComponent(q)}`,
    cookie
  )
  return { status: response.status, body: await response.json() }
}

describe("GET /api/v1/admin/search", () => {
  it("answers with the caller's own destinations only", async () => {
    await createUser("intake")
    const cookie = await signIn("intake@example.com")
    const { status, body } = await search(cookie, "")
    expect(status).toBe(200)
    const hrefs = body.items.map((hit: { href: string }) => hit.href)
    expect(hrefs).toContain("/admin/leads")
    expect(hrefs).not.toContain("/admin/pages")
    expect(hrefs).not.toContain("/admin/users")
  })

  it("finds Users & roles for an owner by keyword", async () => {
    await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")
    const { body } = await search(cookie, "invite")
    expect(body.items).toContainEqual(
      expect.objectContaining({ href: "/admin/users", label: "Users & roles" })
    )
  })

  it("rejects an over-long query", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    const { status, body } = await search(cookie, "x".repeat(101))
    expect(status).toBe(400)
    expect(body.error.code).toBe("VALIDATION_FAILED")
  })
})

// Expected set derived from the registry and the permission table, written
// independently of reachableLinks().
function expectedHrefs(role: RoleName) {
  const ok = (link: NavLink) => hasPermission([role], link.permission)
  const hrefs: string[] = []
  for (const item of NAV.filter(ok)) {
    hrefs.push(item.href)
    for (const child of (item.children ?? []).filter(ok)) hrefs.push(child.href)
  }
  for (const link of [HELP_LINK, ...EXTRA_LINKS].filter(ok)) {
    hrefs.push(link.href)
  }
  return [...new Set(hrefs)].sort()
}

describe.each(ROLE_NAMES)("search for %s", (role) => {
  it("returns exactly the links that role can reach", async () => {
    await createUser(role)
    const email = `${role}@example.com`
    const cookie =
      role === "owner" || role === "admin"
        ? await signInWithTwoFactor(email)
        : await signIn(email)
    const { status, body } = await search(cookie, "")
    expect(status).toBe(200)
    const hrefs = body.items.map((hit: { href: string }) => hit.href)
    expect([...hrefs].sort()).toEqual(expectedHrefs(role))
  })
})
