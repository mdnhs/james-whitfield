import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { articles, media, redirects, revisions } from "@/server/db/schema"
import { findArticleBySlug } from "@/server/modules/content/repo"

import { content, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)
const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const json = (r: Response) => r.json()
const post = (cookie: string, path: string, body: object) =>
  adminRequest(path, cookie, { method: "POST", body })

// A drafted article ready to publish, written by `cookie`.
async function drafted(
  cookie: string,
  overrides: Record<string, unknown> = {}
) {
  const refs = await insertTaxonomy(Math.random().toString(36).slice(2, 8))
  const { id } = await json(
    await post(cookie, "/articles", {
      title: "Calm",
      categoryId: refs.category.id,
      authorId: refs.author.id,
    })
  )
  const draft = content(
    {
      categoryId: refs.category.id,
      authorId: refs.author.id,
      coverId: refs.media.id,
    },
    overrides
  )
  const { version } = await json(
    await adminRequest(`/articles/${id}/draft`, cookie, {
      method: "PATCH",
      body: { version: 1, draft },
    })
  )
  return { id, version, draft, refs }
}
async function rename(
  cookie: string,
  id: string,
  version: number,
  draft: object,
  slug: string
) {
  const saved = await json(
    await adminRequest(`/articles/${id}/draft`, cookie, {
      method: "PATCH",
      body: { version, draft: { ...draft, slug } },
    })
  )
  return json(
    await post(cookie, `/articles/${id}/publish`, { version: saved.version })
  )
}
const redirectMap = async () =>
  Object.fromEntries(
    (await getDb().select().from(redirects)).map((r) => [
      r.sourcePath,
      r.destination,
    ])
  )

// docs/brief.md §7.2: [publish, schedule, unpublish]
const MATRIX: Record<RoleName, number> = {
  owner: 200,
  admin: 200,
  editor: 200,
  author: 403,
  marketer: 403,
  intake: 403,
  viewer: 403,
}

describe.each(ROLE_NAMES)("publishing RBAC for %s", (role) => {
  it(`publish, schedule, unpublish → ${MATRIX[role]}`, async () => {
    const editor = await cookieFor("editor", "setup-editor@example.com")
    const { id, version } = await drafted(editor)
    const cookie = await cookieFor(role)
    expect(
      (
        await post(cookie, `/articles/${id}/schedule`, {
          version,
          at: new Date(Date.now() + 3_600_000).toISOString(),
        })
      ).status
    ).toBe(MATRIX[role])
    const v = (
      await getDb().select().from(articles).where(eq(articles.id, id))
    )[0]!.version
    expect(
      (await post(cookie, `/articles/${id}/unpublish`, { version: v })).status
    ).toBe(MATRIX[role])
    const v2 = (
      await getDb().select().from(articles).where(eq(articles.id, id))
    )[0]!.version
    expect(
      (await post(cookie, `/articles/${id}/publish`, { version: v2 })).status
    ).toBe(MATRIX[role])
  })
})

describe("publishing", () => {
  it("copies the draft into the typed columns, snapshots it and expires the public tags", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const res = await post(editor, `/articles/${id}/publish`, { version })
    expect(res.status).toBe(200)
    const [row] = await getDb()
      .select()
      .from(articles)
      .where(eq(articles.id, id))
    expect(row).toMatchObject({
      status: "published",
      slug: "calm-test",
      excerpt: "Short excerpt.",
      readingMinutes: 1,
      bodyText: "A calm lead paragraph.",
    })
    expect(row!.publishedAt).not.toBeNull()
    expect(
      await getDb().select().from(revisions).where(eq(revisions.entityId, id))
    ).toHaveLength(1)
    expect(expired()).toEqual(["articles", `article:${id}`])
    expect((await findArticleBySlug("calm-test"))?.title).toBe(
      "Calm is a skill"
    )
  })

  it("refuses an incomplete draft with field errors", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor, { excerpt: "", cover: null })
    const res = await post(editor, `/articles/${id}/publish`, { version })
    expect(res.status).toBe(400)
    expect(Object.keys((await json(res)).error.fieldErrors)).toEqual(
      expect.arrayContaining(["excerpt", "cover"])
    )
  })

  it("keeps a single featured article", async () => {
    const editor = await cookieFor("editor")
    const a = await drafted(editor, { featured: true, slug: "first" })
    await post(editor, `/articles/${a.id}/publish`, { version: a.version })
    const b = await drafted(editor, { featured: true, slug: "second" })
    await post(editor, `/articles/${b.id}/publish`, { version: b.version })
    const featured = await getDb()
      .select({ slug: articles.slug })
      .from(articles)
      .where(eq(articles.featured, true))
    expect(featured).toEqual([{ slug: "second" }])
  })

  it("refuses a draft whose cover image or category has gone", async () => {
    const editor = await cookieFor("editor")
    const gone = await drafted(editor)
    await getDb()
      .update(media)
      .set({ deletedAt: new Date() })
      .where(eq(media.id, gone.refs.media.id))
    const noCover = await post(editor, `/articles/${gone.id}/publish`, {
      version: gone.version,
    })
    expect(noCover.status).toBe(400)
    expect((await json(noCover)).error.fieldErrors).toHaveProperty("_media")
    const orphan = await drafted(editor, {
      categoryId: "00000000-0000-4000-8000-000000000000",
    })
    const noCategory = await post(editor, `/articles/${orphan.id}/publish`, {
      version: orphan.version,
    })
    expect(noCategory.status).toBe(400)
    expect((await json(noCategory)).error.fieldErrors).toHaveProperty(
      "categoryId"
    )
    expect(expired()).toEqual([])
  })

  it("409s a slug another article holds", async () => {
    const editor = await cookieFor("editor")
    const a = await drafted(editor, { slug: "taken" })
    await post(editor, `/articles/${a.id}/publish`, { version: a.version })
    const b = await drafted(editor, { slug: "taken" })
    expect(
      (await post(editor, `/articles/${b.id}/publish`, { version: b.version }))
        .status
    ).toBe(409)
  })

  it("slug renames flatten chains, never loop, and reclaim paths (Review Focus 1)", async () => {
    const editor = await cookieFor("editor")
    const { id, version, draft } = await drafted(editor, { slug: "alpha" })
    let v = (
      await json(await post(editor, `/articles/${id}/publish`, { version }))
    ).version
    // First publish under a never-live slug makes no redirect.
    expect(await redirectMap()).toEqual({})
    v = (await rename(editor, id, v, draft, "beta")).version
    expect(expired()).toContain("redirects")
    v = (await rename(editor, id, v, draft, "gamma")).version
    expect(await redirectMap()).toEqual({
      "/insights/alpha": "/insights/gamma",
      "/insights/beta": "/insights/gamma",
    })
    await rename(editor, id, v, draft, "alpha")
    expect(await redirectMap()).toEqual({
      "/insights/beta": "/insights/alpha",
      "/insights/gamma": "/insights/alpha",
    })
    // Another article published at a redirected path takes it back.
    const other = await drafted(editor, { slug: "beta" })
    await post(editor, `/articles/${other.id}/publish`, {
      version: other.version,
    })
    expect(await redirectMap()).toEqual({
      "/insights/gamma": "/insights/alpha",
    })
  })

  it("deleting a published article removes its redirects and expires the tag", async () => {
    const owner = await cookieFor("owner")
    const { id, version, draft } = await drafted(owner, { slug: "alpha" })
    const { version: v } = await json(
      await post(owner, `/articles/${id}/publish`, { version })
    )
    await rename(owner, id, v, draft, "beta")
    expect(await redirectMap()).toEqual({ "/insights/alpha": "/insights/beta" })
    next.revalidateTag.mockReset()
    const res = await adminRequest(`/articles/${id}`, owner, {
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    expect(await redirectMap()).toEqual({})
    expect(expired()).toContain("redirects")
  })

  it("republishing keeps the original date (Ruling R6)", async () => {
    const editor = await cookieFor("editor")
    const { id, version, draft } = await drafted(editor)
    const first = await json(
      await post(editor, `/articles/${id}/publish`, { version })
    )
    const again = await rename(editor, id, first.version, draft, "calm-test")
    expect(again.publishedAt).toBe(first.publishedAt)
  })
})

describe("scheduling and unpublishing", () => {
  it("schedules only a valid draft in the future", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const past = await post(editor, `/articles/${id}/schedule`, {
      version,
      at: new Date(Date.now() - 60_000).toISOString(),
    })
    expect(past.status).toBe(400)
    expect((await json(past)).error.fieldErrors).toHaveProperty("at")
    const at = new Date(Date.now() + 3_600_000).toISOString()
    const ok = await json(
      await post(editor, `/articles/${id}/schedule`, { version, at })
    )
    expect(new Date(ok.scheduledFor).toISOString()).toBe(at)
    const [row] = await getDb()
      .select()
      .from(articles)
      .where(eq(articles.id, id))
    expect(row!.status).toBe("scheduled")
    expect(expired()).toEqual([])
  })

  it("will not schedule a live article (Ruling R5)", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const { version: v } = await json(
      await post(editor, `/articles/${id}/publish`, { version })
    )
    const res = await post(editor, `/articles/${id}/schedule`, {
      version: v,
      at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    expect(res.status).toBe(400)
  })

  it("unpublishes with a redirect to /insights, and archives", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const { version: v } = await json(
      await post(editor, `/articles/${id}/publish`, { version })
    )
    next.revalidateTag.mockReset()
    const res = await json(
      await post(editor, `/articles/${id}/unpublish`, {
        version: v,
        redirectTo: "/insights",
      })
    )
    expect(res.status).toBe("draft")
    expect(await redirectMap()).toEqual({ "/insights/calm-test": "/insights" })
    expect(expired()).toEqual(["articles", `article:${id}`, "redirects"])
    expect(await findArticleBySlug("calm-test")).toBeNull()
    next.revalidateTag.mockReset()
    const { version: v2 } = await json(
      await post(editor, `/articles/${id}/publish`, { version: res.version })
    )
    expect(await redirectMap()).toEqual({}) // live again: the path is reclaimed
    // A reclaimed path must not stay cached as a redirect.
    expect(expired()).toEqual(["articles", `article:${id}`, "redirects"])
    const archived = await json(
      await post(editor, `/articles/${id}/unpublish`, {
        version: v2,
        archive: true,
      })
    )
    expect(archived.status).toBe("archived")
  })

  it("refuses a redirect to an article that is not live", async () => {
    const editor = await cookieFor("editor")
    const { id, version } = await drafted(editor)
    const { version: v } = await json(
      await post(editor, `/articles/${id}/publish`, { version })
    )
    expect(
      (
        await post(editor, `/articles/${id}/unpublish`, {
          version: v,
          redirectTo: "/insights/nowhere",
        })
      ).status
    ).toBe(400)
  })
})

describe("revisions", () => {
  it("lists one snapshot per publish and restores one into the draft", async () => {
    const editor = await cookieFor("editor")
    const { id, version, draft } = await drafted(editor)
    const first = await json(
      await post(editor, `/articles/${id}/publish`, { version })
    )
    const second = await rename(
      editor,
      id,
      first.version,
      { ...draft, title: "Second title" },
      "calm-test"
    )
    const { items } = await json(
      await adminRequest(`/articles/${id}/revisions`, editor)
    )
    expect(items).toHaveLength(2)
    const oldest = items.at(-1)
    const restored = await post(
      editor,
      `/articles/${id}/revisions/${oldest.id}/restore`,
      { version: second.version }
    )
    expect(restored.status).toBe(200)
    const got = await json(await adminRequest(`/articles/${id}`, editor))
    expect(got.draft.title).toBe("Calm is a skill")
    expect(got.hasUnpublishedChanges).toBe(true)
  })
})
