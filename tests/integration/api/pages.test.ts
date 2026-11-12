import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { media, pages, redirects, revisions } from "@/server/db/schema"
import { writeRevision } from "@/server/lib/revisions"

import { adminRequest, cookieFor } from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const json = (r: Response) => r.json()

async function aboutPage() {
  const asset = await insertMedia()
  const page = await insertPage({
    path: "/about",
    systemKey: "about",
    document: heroDocument(asset.id, "Published"),
    published: true,
  })
  return { asset, page }
}

// Written from docs/brief.md §7.2, not derived from the role definitions.
const MATRIX: Record<RoleName, { read: number; publish: number }> = {
  owner: { read: 200, publish: 200 },
  admin: { read: 200, publish: 200 },
  editor: { read: 200, publish: 200 },
  author: { read: 200, publish: 403 },
  marketer: { read: 200, publish: 403 },
  intake: { read: 403, publish: 403 },
  viewer: { read: 200, publish: 403 },
}

describe.each(ROLE_NAMES)("pages RBAC for %s", (role) => {
  it(`GET /pages → ${MATRIX[role].read}, publish → ${MATRIX[role].publish}`, async () => {
    const { page } = await aboutPage()
    const cookie = await cookieFor(role)
    expect((await adminRequest("/pages", cookie)).status).toBe(
      MATRIX[role].read
    )
    const publish = await adminRequest(`/pages/${page.id}/publish`, cookie, {
      method: "POST",
      body: { version: page.version },
    })
    expect(publish.status).toBe(MATRIX[role].publish)
  })
})

describe("pages API", () => {
  it("autosaves a draft and 409s a stale version, keeping the newer draft", async () => {
    const { asset, page } = await aboutPage()
    const cookie = await cookieFor("editor")
    const first = await adminRequest(`/pages/${page.id}/draft`, cookie, {
      method: "PATCH",
      body: { version: 1, document: heroDocument(asset.id, "Mine") },
    })
    expect(first.status).toBe(200)
    expect((await json(first)).version).toBe(2)

    const stale = await adminRequest(`/pages/${page.id}/draft`, cookie, {
      method: "PATCH",
      body: { version: 1, document: heroDocument(asset.id, "Theirs") },
    })
    expect(stale.status).toBe(409)
    const body = await json(stale)
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.details.current).toMatchObject({
      version: 2,
      updatedBy: "editor",
    })
    const [row] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.id, page.id))
    expect(JSON.stringify(row!.draft)).toContain("Mine")
    // Drafts are not public: nothing to expire.
    expect(expired()).toEqual([])
  })

  it("refuses unknown block types on save", async () => {
    const { page } = await aboutPage()
    const response = await adminRequest(
      `/pages/${page.id}/draft`,
      await cookieFor("editor"),
      {
        method: "PATCH",
        body: {
          version: 1,
          document: {
            blocks: [{ ...heroDocument("x").blocks[0], type: "evil" }],
          },
        },
      }
    )
    expect(response.status).toBe(400)
  })

  it("publish rejects invalid drafts and keeps the published copy", async () => {
    const { asset, page } = await aboutPage()
    const cookie = await cookieFor("editor")
    await adminRequest(`/pages/${page.id}/draft`, cookie, {
      method: "PATCH",
      body: { version: 1, document: heroDocument(asset.id, "") },
    })
    const response = await adminRequest(`/pages/${page.id}/publish`, cookie, {
      method: "POST",
      body: { version: 2 },
    })
    expect(response.status).toBe(400)
    expect((await json(response)).error.fieldErrors).toHaveProperty([
      "blocks.0.data.title",
    ])
    const [row] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.id, page.id))
    expect(JSON.stringify(row!.published)).toContain("Published")
    expect(expired()).toEqual([])
  })

  it("publish refuses images that were deleted", async () => {
    const { asset, page } = await aboutPage()
    await getDb()
      .update(media)
      .set({ deletedAt: new Date() })
      .where(eq(media.id, asset.id))
    const response = await adminRequest(
      `/pages/${page.id}/publish`,
      await cookieFor("editor"),
      {
        method: "POST",
        body: { version: 1 },
      }
    )
    expect(response.status).toBe(400)
  })

  it("publish invalidates the page and routes, snapshots, and restore loads a snapshot", async () => {
    const { asset, page } = await aboutPage()
    const cookie = await cookieFor("editor")
    const publish = (version: number) =>
      adminRequest(`/pages/${page.id}/publish`, cookie, {
        method: "POST",
        body: { version },
      })
    expect((await publish(1)).status).toBe(200)
    expect(expired()).toEqual(
      expect.arrayContaining([`page:${page.id}`, "routes"])
    )

    await adminRequest(`/pages/${page.id}/draft`, cookie, {
      method: "PATCH",
      body: { version: 2, document: heroDocument(asset.id, "Second") },
    })
    expect((await publish(3)).status).toBe(200)

    const list = await json(
      await adminRequest(`/pages/${page.id}/revisions`, cookie)
    )
    expect(list.items).toHaveLength(2)
    const oldest = list.items.at(-1)
    const restored = await adminRequest(
      `/pages/${page.id}/revisions/${oldest.id}/restore`,
      cookie,
      { method: "POST", body: { version: 4 } }
    )
    expect(restored.status).toBe(200)
    const detail = await json(await adminRequest(`/pages/${page.id}`, cookie))
    expect(JSON.stringify(detail.draft)).toContain("Published")
    expect(detail.hasUnpublishedChanges).toBe(true)
  })

  describe("fixed structure", () => {
    const patch = (id: string, cookie: string, document: unknown) =>
      adminRequest(`/pages/${id}/draft`, cookie, {
        method: "PATCH",
        body: { version: 1, document },
      })

    it("refuses an extra or reordered block, accepts content changes", async () => {
      const asset = await insertMedia()
      const cookie = await cookieFor("editor")
      const first = heroDocument(asset.id).blocks[0]!
      const second = {
        ...first,
        id: "block-two",
        type: "richtext",
        anchor: "two",
      }
      const page = await insertPage({
        path: "/about",
        systemKey: "about",
        document: { blocks: [first, second] },
      })

      const extra = await patch(page.id, cookie, {
        blocks: [
          first,
          second,
          { ...second, id: "block-three", anchor: "three" },
        ],
      })
      expect(extra.status).toBe(400)
      expect((await json(extra)).error.code).toBe("VALIDATION_FAILED")

      expect(
        (await patch(page.id, cookie, { blocks: [second, first] })).status
      ).toBe(400)

      const edited = {
        blocks: [
          {
            ...first,
            id: "other-id-1",
            chapter: "Renamed",
            joinPrevious: true,
          },
          second,
        ],
      }
      expect((await patch(page.id, cookie, edited)).status).toBe(200)
    })

    it("refuses to restore a version with a different layout", async () => {
      const { asset, page } = await aboutPage()
      const cookie = await cookieFor("editor")
      const first = heroDocument(asset.id).blocks[0]!
      await writeRevision(getDb(), {
        entityType: "page",
        entityId: page.id,
        version: 1,
        snapshot: { blocks: [first, { ...first, id: "block-x", anchor: "x" }] },
        createdBy: null,
      })
      const [old] = await getDb()
        .select()
        .from(revisions)
        .where(eq(revisions.entityId, page.id))
      const response = await adminRequest(
        `/pages/${page.id}/revisions/${old!.id}/restore`,
        cookie,
        { method: "POST", body: { version: page.version } }
      )
      expect(response.status).toBe(400)
      expect((await json(response)).error.message).toBe(
        "This version has a different layout and can't be restored"
      )
      const [row] = await getDb()
        .select()
        .from(pages)
        .where(eq(pages.id, page.id))
      expect(row!.draft).toEqual(page.draft)
      expect(row!.version).toBe(page.version)
    })

    it("refuses to discard onto a different published layout", async () => {
      const asset = await insertMedia()
      const cookie = await cookieFor("editor")
      const first = heroDocument(asset.id).blocks[0]!
      const [page] = await getDb()
        .insert(pages)
        .values({
          path: "/about",
          title: "About",
          systemKey: "about",
          status: "published",
          draft: { blocks: [first] },
          published: {
            blocks: [first, { ...first, id: "block-x", anchor: "x" }],
          },
        } as typeof pages.$inferInsert)
        .returning()
      const response = await adminRequest(
        `/pages/${page!.id}/discard`,
        cookie,
        { method: "POST", body: { version: page!.version } }
      )
      expect(response.status).toBe(400)
      const [row] = await getDb()
        .select()
        .from(pages)
        .where(eq(pages.id, page!.id))
      expect(row!.draft).toEqual(page!.draft)
    })
  })

  it("keeps the newest 50 page revisions", async () => {
    const { page } = await aboutPage()
    const { id: userId } = (
      await json(await adminRequest("/me", await cookieFor("editor")))
    ).user
    for (let v = 1; v <= 52; v++) {
      await writeRevision(getDb(), {
        entityType: "page",
        entityId: page.id,
        version: v,
        snapshot: {},
        createdBy: userId,
      })
    }
    const rows = await getDb()
      .select()
      .from(revisions)
      .where(eq(revisions.entityId, page.id))
    expect(rows).toHaveLength(50)
    expect(Math.min(...rows.map((r) => r.version))).toBe(3)
  })

  it("has no create route, and deletes custom pages but never system ones", async () => {
    const { page: about } = await aboutPage()
    const cookie = await cookieFor("editor")
    const created = await adminRequest("/pages", cookie, {
      method: "POST",
      body: { path: "/team", title: "Team" },
    })
    expect([404, 405]).toContain(created.status)

    const { id } = await insertPage({
      path: "/team",
      document: { blocks: [] },
    })
    expect(
      (await adminRequest(`/pages/${about.id}`, cookie, { method: "DELETE" }))
        .status
    ).toBe(403)
    next.revalidateTag.mockReset()
    expect(
      (await adminRequest(`/pages/${id}`, cookie, { method: "DELETE" })).status
    ).toBe(200)
    expect(expired()).toEqual(expect.arrayContaining([`page:${id}`, "routes"]))
  })

  it("removes redirects into a deleted page", async () => {
    await aboutPage()
    const cookie = await cookieFor("editor")
    const { id } = await insertPage({
      path: "/team",
      document: { blocks: [] },
    })
    await getDb()
      .insert(redirects)
      .values([
        { sourcePath: "/old-team", destination: "/team" },
        { sourcePath: "/old-other", destination: "/about" },
      ])
    next.revalidateTag.mockReset()
    expect(
      (await adminRequest(`/pages/${id}`, cookie, { method: "DELETE" })).status
    ).toBe(200)
    const left = await getDb().select().from(redirects)
    expect(left.map((r) => r.sourcePath)).toEqual(["/old-other"])
    expect(expired()).toEqual(
      expect.arrayContaining([`page:${id}`, "routes", "redirects"])
    )
  })

  it("lets a marketer change SEO but not the title", async () => {
    const { page } = await aboutPage()
    const cookie = await cookieFor("marketer")
    const seo = await adminRequest(`/pages/${page.id}/seo`, cookie, {
      method: "PATCH",
      body: { seo: { description: "New description" } },
    })
    expect(seo.status).toBe(200)
    expect((await json(seo)).seo.description).toBe("New description")
    expect(expired()).toContain(`page:${page.id}`)
    const title = await adminRequest(`/pages/${page.id}/seo`, cookie, {
      method: "PATCH",
      body: { title: "Hijacked", seo: { noindex: true } },
    })
    expect(title.status).toBe(403)
  })
})

describe("share image validation (Ruling R13)", () => {
  it("rejects a small or off-ratio share image and accepts 1200×630", async () => {
    const { page } = await aboutPage()
    const cookie = await cookieFor("marketer")
    const small = await insertMedia({ width: 800, height: 800 })
    const bad = await adminRequest(`/pages/${page.id}/seo`, cookie, {
      method: "PATCH",
      body: { seo: { ogImage: { mediaId: small.id } } },
    })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.fieldErrors.ogImage).toEqual([
      "Use an image at least 1200×630 (1.91:1)",
    ])
    const good = await insertMedia({ width: 1200, height: 630 })
    const ok = await adminRequest(`/pages/${page.id}/seo`, cookie, {
      method: "PATCH",
      body: {
        seo: {
          ogImage: { mediaId: good.id },
          canonical: "/about",
          twitterCard: "summary",
        },
      },
    })
    expect(ok.status).toBe(200)
    expect((await ok.json()).seo).toMatchObject({
      canonical: "/about",
      twitterCard: "summary",
    })
  })
})
