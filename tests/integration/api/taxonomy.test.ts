import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { media as mediaTable } from "@/server/db/schema"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { insertMedia } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)
const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const category = (slug = "anxiety") => ({
  slug,
  name: "Anxiety",
  description: "",
  relatedServiceId: null,
  isVisible: true,
})

// Ruling R3: read = article.read, write = article.publish. [GET, POST]
const MATRIX: Record<RoleName, [number, number]> = {
  owner: [200, 201],
  admin: [200, 201],
  editor: [200, 201],
  author: [200, 403],
  marketer: [200, 403],
  intake: [403, 403],
  viewer: [200, 403],
}

describe.each(ROLE_NAMES)("taxonomy RBAC for %s", (role) => {
  it(`GET, POST categories → ${MATRIX[role].join(", ")}`, async () => {
    const cookie = await cookieFor(role)
    expect((await adminRequest("/categories", cookie)).status).toBe(
      MATRIX[role][0]
    )
    expect(
      (
        await adminRequest("/categories", cookie, {
          method: "POST",
          body: category(),
        })
      ).status
    ).toBe(MATRIX[role][1])
  })
})

describe("taxonomy API", () => {
  it("creates, updates with a version, 409s stale and duplicate slugs, invalidates", async () => {
    const cookie = await cookieFor("editor")
    const created = await (
      await adminRequest("/categories", cookie, {
        method: "POST",
        body: category(),
      })
    ).json()
    expect(created.version).toBe(1)
    expect(expired()).toEqual(["categories"])
    const dup = await adminRequest("/categories", cookie, {
      method: "POST",
      body: category(),
    })
    expect(dup.status).toBe(409)
    expect((await dup.json()).error.fieldErrors).toHaveProperty("slug")
    const patch = (version: number) =>
      adminRequest(`/categories/${created.id}`, cookie, {
        method: "PATCH",
        body: { version, values: { ...category(), name: "Stress" } },
      })
    expect((await (await patch(1)).json()).name).toBe("Stress")
    expect((await patch(1)).status).toBe(409)
  })

  it("refuses to delete a category or author in use, and lists usage", async () => {
    const cookie = await cookieFor("editor")
    const { category: cat, author, media } = await insertTaxonomy()
    await insertArticle({
      slug: "used",
      categoryId: cat.id,
      authorId: author.id,
      coverId: media.id,
    })
    const list = await (await adminRequest("/categories", cookie)).json()
    expect(list.items[0].articleCount).toBe(1)
    expect(
      (
        await adminRequest(`/categories/${cat.id}`, cookie, {
          method: "DELETE",
        })
      ).status
    ).toBe(409)
    expect(
      (
        await adminRequest(`/authors/${author.id}`, cookie, {
          method: "DELETE",
        })
      ).status
    ).toBe(409)
  })

  it("speaks { mediaId } for author avatars and rejects deleted images", async () => {
    const cookie = await cookieFor("editor")
    const asset = await insertMedia()
    const author = {
      slug: "magda",
      name: "Magda",
      roleTitle: "",
      bio: "",
      avatar: { mediaId: asset.id },
      isVisible: true,
    }
    const created = await (
      await adminRequest("/authors", cookie, { method: "POST", body: author })
    ).json()
    expect(created.avatar).toEqual({ mediaId: asset.id })
    expect(created).not.toHaveProperty("avatarId")
    expect(expired()).toEqual(["authors"])
    await getDb().update(mediaTable).set({ deletedAt: new Date() })
    const bad = await adminRequest("/authors", cookie, {
      method: "POST",
      body: { ...author, slug: "other" },
    })
    expect(bad.status).toBe(400)
  })
})
