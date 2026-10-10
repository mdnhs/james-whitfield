import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: next.revalidateTag,
}))

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, redirects, settings } from "@/server/db/schema"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const redirectMap = async () =>
  Object.fromEntries(
    (await getDb().select().from(redirects)).map((r) => [
      r.sourcePath,
      r.destination,
    ])
  )

describe("redirects admin", () => {
  it("lets owner, admin, editor and marketer manage; others are refused", async () => {
    // §7.2: redirect.read · manage → owner, admin, editor, marketer.
    for (const role of ["owner", "admin", "editor", "marketer"] as const) {
      const cookie = await cookieFor(role)
      const res = await adminRequest("/seo/redirects", cookie, {
        method: "POST",
        body: { sourcePath: `/from-${role}`, destination: "/" },
      })
      expect(res.status, role).toBe(201)
    }
    for (const role of ["author", "intake", "viewer"] as const) {
      const cookie = await cookieFor(role)
      expect((await adminRequest("/seo/redirects", cookie)).status, role).toBe(
        403
      )
    }
  })

  it("creates, lists with hits, updates and deletes, auditing and expiring the tag", async () => {
    const cookie = await cookieFor("marketer")
    const created = await adminRequest("/seo/redirects", cookie, {
      method: "POST",
      body: {
        sourcePath: "/old-page/",
        destination: "/contact",
        statusCode: 308,
        note: "Old site",
      },
    })
    expect(created.status).toBe(201)
    const { redirect, warning } = await created.json()
    expect(redirect).toMatchObject({
      sourcePath: "/old-page",
      destination: "/contact",
      statusCode: 308,
      automatic: false,
      shadowed: false,
    })
    expect(warning).toBeNull()
    expect(expired()).toContain("redirects")
    const dupe = await adminRequest("/seo/redirects", cookie, {
      method: "POST",
      body: { sourcePath: "/old-page", destination: "/" },
    })
    expect(dupe.status).toBe(409)
    const list = await (
      await adminRequest("/seo/redirects?q=old", cookie)
    ).json()
    expect(list).toMatchObject({ total: 1, items: [{ hitCount: 0 }] })
    const patched = await adminRequest(
      `/seo/redirects/${redirect.id}`,
      cookie,
      { method: "PATCH", body: { isActive: false } }
    )
    expect((await patched.json()).redirect.isActive).toBe(false)
    expect(
      (
        await adminRequest(`/seo/redirects/${redirect.id}`, cookie, {
          method: "DELETE",
        })
      ).status
    ).toBe(200)
    const actions = (await getDb().select().from(auditLogs)).map(
      (a) => a.action
    )
    expect(actions).toEqual(
      expect.arrayContaining([
        "redirect.create",
        "redirect.update",
        "redirect.delete",
      ])
    )
  })

  // Task 6 review carry: the route table is cached under `routes` too.
  it("expires the redirects and routes tags on every write", async () => {
    const cookie = await cookieFor("editor")
    const created = await adminRequest("/seo/redirects", cookie, {
      method: "POST",
      body: { sourcePath: "/old", destination: "/new" },
    })
    const { redirect } = await created.json()
    expect(expired()).toEqual(["redirects", "routes"])
    for (const body of [
      { destination: "/other" },
      { statusCode: 302 },
      { isActive: false },
      { isActive: true },
      { note: "Moved" },
    ]) {
      next.revalidateTag.mockReset()
      const res = await adminRequest(`/seo/redirects/${redirect.id}`, cookie, {
        method: "PATCH",
        body,
      })
      expect(res.status, JSON.stringify(body)).toBe(200)
      expect(expired(), JSON.stringify(body)).toEqual(["redirects", "routes"])
    }
    next.revalidateTag.mockReset()
    await adminRequest(`/seo/redirects/${redirect.id}`, cookie, {
      method: "DELETE",
    })
    expect(expired()).toEqual(["redirects", "routes"])
  })

  it("flattens chains (Review Focus 3)", async () => {
    const cookie = await cookieFor("editor")
    const post = (sourcePath: string, destination: string) =>
      adminRequest("/seo/redirects", cookie, {
        method: "POST",
        body: { sourcePath, destination },
      })
    await post("/a", "/b")
    await post("/b", "/c") // /a now points at /c
    const created = await (await post("/z", "/a")).json() // /z lands on /c directly
    expect(created.redirect.destination).toBe("/c")
    expect(await redirectMap()).toEqual({ "/a": "/c", "/b": "/c", "/z": "/c" })
  })

  it("serialises concurrent opposite creates so no loop is stored", async () => {
    const cookie = await cookieFor("editor")
    const post = (sourcePath: string, destination: string) =>
      adminRequest("/seo/redirects", cookie, {
        method: "POST",
        body: { sourcePath, destination },
      })
    for (let round = 0; round < 5; round++) {
      await getDb().delete(redirects)
      const results = await Promise.all([post("/a", "/b"), post("/b", "/a")])
      const statuses = results.map((r) => r.status).sort()
      expect(statuses, `round ${round}`).toEqual([201, 400])
      const loser = results.find((r) => r.status === 400)!
      expect((await loser.json()).error.fieldErrors.destination).toEqual([
        "That would create a redirect loop",
      ])
      expect(await getDb().$count(redirects)).toBe(1)
    }
  })

  it("rejects loops (Review Focus 3)", async () => {
    const cookie = await cookieFor("editor")
    await adminRequest("/seo/redirects", cookie, {
      method: "POST",
      body: { sourcePath: "/a", destination: "/b" },
    })
    const loop = await adminRequest("/seo/redirects", cookie, {
      method: "POST",
      body: { sourcePath: "/b", destination: "/a" },
    })
    expect(loop.status).toBe(400)
    expect((await loop.json()).error.fieldErrors.destination).toEqual([
      "That would create a redirect loop",
    ])
    expect(await getDb().$count(redirects)).toBe(1)
  })

  it("rejects a loop made by editing a destination or switching a row back on", async () => {
    const cookie = await cookieFor("editor")
    const post = async (sourcePath: string, destination: string) =>
      (
        await (
          await adminRequest("/seo/redirects", cookie, {
            method: "POST",
            body: { sourcePath, destination },
          })
        ).json()
      ).redirect
    const ab = await post("/a", "/b")
    const cd = await post("/c", "/d")
    const edit = await adminRequest(`/seo/redirects/${cd.id}`, cookie, {
      method: "PATCH",
      body: { destination: "/a" },
    })
    expect((await edit.json()).redirect.destination).toBe("/b")
    await adminRequest(`/seo/redirects/${ab.id}`, cookie, {
      method: "PATCH",
      body: { isActive: false },
    })
    await post("/b", "/a") // allowed: /a → /b is off
    const back = await adminRequest(`/seo/redirects/${ab.id}`, cookie, {
      method: "PATCH",
      body: { isActive: true },
    })
    expect(back.status).toBe(400)
    const [row] = (await getDb().select().from(redirects)).filter(
      (r) => r.id === ab.id
    )
    expect(row!.isActive).toBe(false)
  })

  it("warns when the source is live and marks the row shadowed (Review Focus 4)", async () => {
    const asset = await insertMedia()
    await insertPage({
      path: "/about",
      systemKey: "about",
      document: heroDocument(asset.id),
      published: true,
    })
    const cookie = await cookieFor("editor")
    const res = await adminRequest("/seo/redirects", cookie, {
      method: "POST",
      body: { sourcePath: "/about", destination: "/services" },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.warning).toBe(
      "A live page is at this address, so the redirect waits until that page is unpublished or moved."
    )
    expect(body.redirect.shadowed).toBe(true)
  })

  it("an unpublished article's redirect repoints chains that ended at it", async () => {
    // /x → /insights/old exists; unpublishing /insights/old with redirectTo /insights
    // must leave /x → /insights (Phase 5 minor, Ruling R5).
    const owner = await cookieFor("owner")
    const { category, author, media } = await insertTaxonomy()
    const article = await insertArticle({
      slug: "old",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    })
    await getDb()
      .insert(redirects)
      .values({ sourcePath: "/x", destination: "/insights/old" })
    const res = await adminRequest(`/articles/${article.id}/unpublish`, owner, {
      method: "POST",
      body: {
        version: article.version,
        archive: false,
        redirectTo: "/insights",
      },
    })
    expect(res.status).toBe(200)
    expect(await redirectMap()).toEqual({
      "/x": "/insights",
      "/insights/old": "/insights",
    })
    expect(expired()).toEqual(expect.arrayContaining(["redirects", "routes"]))
  })
})

describe("page address change (Ruling R6)", () => {
  it("warns when the header or footer still links to the old address", async () => {
    await getDb()
      .insert(settings)
      .values([
        {
          key: "navigation",
          value: { links: [{ label: "Team", href: "/team#people" }] },
        },
        {
          key: "footer",
          value: {
            columns: [
              { title: "Practice", links: [{ label: "Team", href: "/team" }] },
            ],
          },
        },
      ])
    const asset = await insertMedia()
    const page = await insertPage({
      path: "/team",
      document: heroDocument(asset.id),
      published: true,
    })
    const res = await adminRequest(
      `/pages/${page.id}/path`,
      await cookieFor("editor"),
      { method: "PATCH", body: { path: "/our-team" } }
    )
    expect((await res.json()).warnings).toEqual([
      "The header navigation still links to /team",
      "The footer still links to /team",
    ])
  })

  it("moves a published custom page and leaves an automatic 301", async () => {
    const asset = await insertMedia()
    const page = await insertPage({
      path: "/team",
      document: heroDocument(asset.id),
      published: true,
    })
    const editor = await cookieFor("editor")
    const res = await adminRequest(`/pages/${page.id}/path`, editor, {
      method: "PATCH",
      body: { path: "/our-team" },
    })
    expect(await res.json()).toEqual({
      path: "/our-team",
      redirected: true,
      warnings: [],
    })
    const [row] = await getDb().select().from(redirects)
    expect(row).toMatchObject({
      sourcePath: "/team",
      destination: "/our-team",
      statusCode: 301,
      pageId: page.id,
    })
    expect(expired()).toEqual(
      expect.arrayContaining(["routes", "redirects", `page:${page.id}`])
    )
    const list = await (await adminRequest("/seo/redirects", editor)).json()
    expect(list.items[0].automatic).toBe(true)
  })

  it("moves a draft page without a redirect, refuses system pages and taken addresses", async () => {
    const asset = await insertMedia()
    const draft = await insertPage({
      path: "/draft",
      document: heroDocument(asset.id),
    })
    await insertPage({ path: "/taken", document: heroDocument(asset.id) })
    const about = await insertPage({
      path: "/about",
      systemKey: "about",
      document: heroDocument(asset.id),
      published: true,
    })
    const editor = await cookieFor("editor")
    const move = (id: string, path: string) =>
      adminRequest(`/pages/${id}/path`, editor, {
        method: "PATCH",
        body: { path },
      })
    expect(await (await move(draft.id, "/moved")).json()).toEqual({
      path: "/moved",
      redirected: false,
      warnings: [],
    })
    expect((await move(draft.id, "/taken")).status).toBe(409)
    expect((await move(about.id, "/about-us")).status).toBe(403)
    expect((await move(draft.id, "/insights")).status).toBe(400)
    expect(await getDb().$count(redirects)).toBe(0)
  })
})
