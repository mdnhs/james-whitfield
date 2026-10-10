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
  cookieFor,
  createUser,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { insertArticle, insertTaxonomy } from "../helpers/articles"
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

describe("⌘K article hits", () => {
  it("finds articles for article.read holders and none for intake", async () => {
    const refs = await insertTaxonomy()
    await insertArticle({
      slug: "box-breathing",
      categoryId: refs.category.id,
      authorId: refs.author.id,
      coverId: refs.media.id,
    })
    const editor = await adminRequest(
      "/search?q=box",
      await cookieFor("editor")
    )
    expect((await editor.json()).items).toContainEqual(
      expect.objectContaining({ kind: "article", label: "Title box-breathing" })
    )
    const intake = await adminRequest(
      "/search?q=box",
      await cookieFor("intake")
    )
    expect(
      (await intake.json()).items.some(
        (i: { kind: string }) => i.kind === "article"
      )
    ).toBe(false)
  })
  it("rate-limits a user to 30 searches per 10 seconds", async () => {
    const cookie = await cookieFor("viewer")
    const statuses = []
    for (let i = 0; i < 31; i++)
      statuses.push((await adminRequest("/search?q=a", cookie)).status)
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true)
    expect(statuses[30]).toBe(429)
  })
})
