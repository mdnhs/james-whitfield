import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { adminRequest, cookieFor } from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /seo/overview", () => {
  it("scores live entities, lists issues with fix links and counts alt coverage", async () => {
    const described = await insertMedia({
      alt: "Magda in the clinic",
      width: 1600,
      height: 900,
    })
    const bare = await insertMedia({ alt: "", filename: "bare.jpg" })
    const decorative = await insertMedia({ alt: "", isDecorative: true })
    await getDb()
      .insert(settings)
      .values({
        key: "seo",
        value: {
          titleTemplate: "%s | Magda Kennedy",
          defaultTitle: "Magda Kennedy: Clinical Hypnotherapist",
        },
      })
    const about = await insertPage({
      path: "/about",
      systemKey: "about",
      document: heroDocument(bare.id, "About"),
      published: true,
    })
    await insertPage({ path: "/draft", document: heroDocument(described.id) }) // not live: ignored
    const { category, author } = await insertTaxonomy()
    await insertArticle({
      slug: "calm",
      categoryId: category.id,
      authorId: author.id,
      coverId: decorative.id,
    })
    const cookie = await cookieFor("viewer") // seo.read
    const res = await adminRequest("/seo/overview", cookie)
    expect(res.status).toBe(200)
    const health = await res.json()
    expect(health.entities).toBe(2)
    expect(health.total).toBe(16)
    expect(health.score).toBe(Math.round((health.passed / 16) * 100))
    const aboutIssues = health.issues
      .filter((i: { id: string }) => i.id === about.id)
      .map((i: { check: string }) => i.check)
    expect(aboutIssues).toEqual(
      expect.arrayContaining(["title-length", "description", "alt-text"])
    )
    expect(
      health.issues.find((i: { check: string }) => i.check === "alt-text")
        .fixHref
    ).toBe(`/admin/pages/${about.id}?tab=seo`)
    expect(health.issues).toContainEqual(
      expect.objectContaining({
        kind: "media",
        id: bare.id,
        fixHref: "/admin/media?missingAlt=true&q=bare.jpg",
      })
    )
    expect(health.alt).toMatchObject({ missing: 1, decorative: 1 })
    expect(
      (await adminRequest("/seo/overview", await cookieFor("intake"))).status
    ).toBe(403)
  })
})
