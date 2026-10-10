import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { articles, authors, users } from "@/server/db/schema"

import { content, insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)
const json = (r: Response) => r.json()
const create = (cookie: string, body: object) =>
  adminRequest("/articles", cookie, { method: "POST", body })
const saveDraft = (
  cookie: string,
  id: string,
  version: number,
  draft: object
) =>
  adminRequest(`/articles/${id}/draft`, cookie, {
    method: "PATCH",
    body: { version, draft },
  })
const userId = async (email: string) =>
  (
    await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
  )[0]!.id

// docs/brief.md §7.2. [GET list, POST create]
const MATRIX: Record<RoleName, [number, number]> = {
  owner: [200, 201],
  admin: [200, 201],
  editor: [200, 201],
  author: [200, 201],
  marketer: [200, 403],
  intake: [403, 403],
  viewer: [200, 403],
}

describe.each(ROLE_NAMES)("articles RBAC for %s", (role) => {
  it(`GET /articles → ${MATRIX[role][0]}, POST → ${MATRIX[role][1]}`, async () => {
    const { category } = await insertTaxonomy()
    const cookie = await cookieFor(role)
    expect((await adminRequest("/articles", cookie)).status).toBe(
      MATRIX[role][0]
    )
    expect(
      (await create(cookie, { title: "Hello", categoryId: category.id })).status
    ).toBe(MATRIX[role][1])
  })
})

describe("articles API", () => {
  it("creates a draft with a unique slug and the writer's own author row", async () => {
    const { category } = await insertTaxonomy()
    const cookie = await cookieFor("author")
    const a = await json(
      await create(cookie, {
        title: "Calm Is A Skill",
        categoryId: category.id,
      })
    )
    const b = await json(
      await create(cookie, {
        title: "Calm is a skill",
        categoryId: category.id,
      })
    )
    const one = await json(await adminRequest(`/articles/${a.id}`, cookie))
    const two = await json(await adminRequest(`/articles/${b.id}`, cookie))
    expect(one.draft.slug).toBe("calm-is-a-skill")
    expect(two.draft.slug).toBe("calm-is-a-skill-2")
    expect(one.status).toBe("draft")
    const [mine] = await getDb()
      .select()
      .from(authors)
      .where(eq(authors.userId, await userId("author@example.com")))
    expect(one.draft.authorId).toBe(mine!.id)
    expect(two.draft.authorId).toBe(mine!.id)
    expect(next.revalidateTag).not.toHaveBeenCalled()
  })

  it("autosaves with a version and 409s a stale one", async () => {
    const refs = await insertTaxonomy()
    const cookie = await cookieFor("editor")
    const { id } = await json(
      await create(cookie, {
        title: "Draft",
        categoryId: refs.category.id,
        authorId: refs.author.id,
      })
    )
    const draft = content({
      categoryId: refs.category.id,
      authorId: refs.author.id,
      coverId: refs.media.id,
    })
    const first = await saveDraft(cookie, id, 1, draft)
    expect((await json(first)).version).toBe(2)
    const stale = await saveDraft(cookie, id, 1, draft)
    expect(stale.status).toBe(409)
    expect((await json(stale)).error.details.current.version).toBe(2)
  })

  it("enforces ownership for authors (Review Focus 2)", async () => {
    const refs = await insertTaxonomy()
    const writer = await cookieFor("author", "writer@example.com")
    const other = await cookieFor("author", "other@example.com")
    const editor = await cookieFor("editor")
    const { id } = await json(
      await create(writer, { title: "Mine", categoryId: refs.category.id })
    )
    const draft = (await json(await adminRequest(`/articles/${id}`, writer)))
      .draft
    expect((await saveDraft(other, id, 1, draft)).status).toBe(403)
    expect((await adminRequest(`/articles/${id}`, other)).status).toBe(200) // read is everyone's
    // Crediting someone else is an editor's call.
    expect(
      (await saveDraft(writer, id, 1, { ...draft, authorId: refs.author.id }))
        .status
    ).toBe(403)
    expect(
      (await saveDraft(editor, id, 1, { ...draft, title: "Edited" })).status
    ).toBe(200)
    // An article that lists the writer as author is theirs too.
    const theirs = await insertArticle({
      slug: "listed",
      categoryId: refs.category.id,
      authorId: draft.authorId,
      coverId: refs.media.id,
      status: "draft",
    })
    const got = await json(await adminRequest(`/articles/${theirs.id}`, writer))
    expect(got.canEdit).toBe(true)
    expect(
      (await saveDraft(writer, theirs.id, theirs.version, got.draft)).status
    ).toBe(200)
  })

  it("lets an author delete only drafts that were never published", async () => {
    const refs = await insertTaxonomy()
    const writer = await cookieFor("author")
    const { id } = await json(
      await create(writer, { title: "Mine", categoryId: refs.category.id })
    )
    await getDb()
      .update(articles)
      .set({ publishedAt: new Date(), status: "archived" })
      .where(eq(articles.id, id))
    expect(
      (await adminRequest(`/articles/${id}`, writer, { method: "DELETE" }))
        .status
    ).toBe(403)
    await getDb()
      .update(articles)
      .set({ publishedAt: null, status: "draft" })
      .where(eq(articles.id, id))
    expect(
      (await adminRequest(`/articles/${id}`, writer, { method: "DELETE" }))
        .status
    ).toBe(200)
  })

  it("deleting a published article expires the public tags", async () => {
    const refs = await insertTaxonomy()
    const art = await insertArticle({
      slug: "live",
      categoryId: refs.category.id,
      authorId: refs.author.id,
      coverId: refs.media.id,
    })
    await adminRequest(`/articles/${art.id}`, await cookieFor("editor"), {
      method: "DELETE",
    })
    expect(next.revalidateTag.mock.calls.map(([t]) => t)).toEqual([
      "articles",
      `article:${art.id}`,
    ])
  })

  it("submits for review and SEO saves live for seo.update holders only", async () => {
    const refs = await insertTaxonomy()
    const writer = await cookieFor("author")
    const { id } = await json(
      await create(writer, { title: "Mine", categoryId: refs.category.id })
    )
    const submitted = await adminRequest(`/articles/${id}/submit`, writer, {
      method: "POST",
    })
    expect((await json(submitted)).reviewRequestedAt).toBeTruthy()
    const list = await json(
      await adminRequest("/articles?review=requested", writer)
    )
    expect(list.items.map((i: { id: string }) => i.id)).toEqual([id])
    expect(
      (
        await adminRequest(`/articles/${id}/seo`, writer, {
          method: "PATCH",
          body: { title: "X" },
        })
      ).status
    ).toBe(403)
    const seo = await adminRequest(
      `/articles/${id}/seo`,
      await cookieFor("marketer"),
      { method: "PATCH", body: { title: "SEO title" } }
    )
    expect((await json(seo)).seo.title).toBe("SEO title")
  })

  it("filters and searches the list (Ruling R7)", async () => {
    const refs = await insertTaxonomy()
    await insertArticle({
      slug: "breathing",
      categoryId: refs.category.id,
      authorId: refs.author.id,
      coverId: refs.media.id,
    })
    await getDb()
      .update(articles)
      .set({ bodyText: "Box breathing calms the nervous system" })
    const cookie = await cookieFor("editor")
    await create(cookie, {
      title: "Sleep hygiene draft",
      categoryId: refs.category.id,
      authorId: refs.author.id,
    })
    const q = async (s: string) =>
      (await json(await adminRequest(`/articles?${s}`, cookie))).items.map(
        (i: { slug: string }) => i.slug
      )
    expect(await q("q=nervous")).toEqual(["breathing"])
    expect(await q("q=sleep")).toEqual(["sleep-hygiene-draft"])
    expect(await q("status=draft")).toEqual(["sleep-hygiene-draft"])
    expect(await q("q=%22unbalanced")).toEqual([])
  })

  it("never lets an author touch another's article or set status through a write path", async () => {
    const refs = await insertTaxonomy()
    const writer = await cookieFor("author", "writer@example.com")
    const other = await cookieFor("author", "other@example.com")
    const { id } = await json(
      await create(writer, { title: "Mine", categoryId: refs.category.id })
    )
    const draft = (await json(await adminRequest(`/articles/${id}`, writer)))
      .draft
    expect(
      (await adminRequest(`/articles/${id}`, other, { method: "DELETE" }))
        .status
    ).toBe(403)
    expect(
      (await adminRequest(`/articles/${id}/submit`, other, { method: "POST" }))
        .status
    ).toBe(403)
    const res = await adminRequest(`/articles/${id}/draft`, writer, {
      method: "PATCH",
      body: {
        version: 1,
        status: "published",
        publishedAt: new Date().toISOString(),
        draft: { ...draft, status: "published" },
      },
    })
    expect(res.status).toBe(200)
    const [row] = await getDb()
      .select()
      .from(articles)
      .where(eq(articles.id, id))
    expect(row!.status).toBe("draft")
    expect(row!.publishedAt).toBeNull()
    expect(
      await getDb().select().from(articles).where(eq(articles.id, id))
    ).toHaveLength(1)
  })
})
