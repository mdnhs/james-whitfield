import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

// A pass-through spy: the dashboard must load the live content once.
vi.mock("@/server/modules/seo/live", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/seo/live")>()
  return { ...actual, listLiveEntities: vi.fn(actual.listLiveEntities) }
})

import { cacheTag } from "next/cache"

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { listLiveEntities } from "@/server/modules/seo/live"

import { adminRequest, cookieFor } from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("dashboard content health", () => {
  it("lists §4.6 findings with links for an editor, and buckets live pages", async () => {
    const cookie = await cookieFor("editor")
    const media = await insertMedia({ alt: "", filename: "bare.jpg" })
    await insertPage({
      path: "/about",
      document: heroDocument(media.id, "James works here"),
      published: true,
    })
    await insertPage({
      path: "/privacy",
      document: heroDocument(media.id, "Privacy"),
      published: false,
    })
    await getDb()
      .insert(settings)
      .values({
        key: "footer",
        value: {
          contactLines: ["[email]"],
          contactNote: "Online sessions available - Ireland, UK & USA.",
        },
      })
    await getDb()
      .insert(settings)
      .values({
        key: "contact",
        value: {
          onlineNote: "Online sessions available worldwide via secure Zoom.",
        },
      })

    const response = await adminRequest("/dashboard", cookie)
    const { contentHealth } = await response.json()
    const rules = contentHealth.findings.map((f: { rule: string }) => f.rule)
    expect(rules).toEqual(
      expect.arrayContaining([
        "rebrand",
        "placeholder-contact",
        "online-reach",
        "legal-unpublished",
      ])
    )
    expect(contentHealth.findingsTotal).toBe(contentHealth.findings.length)
    expect(
      contentHealth.findings.find(
        (f: { rule: string }) => f.rule === "placeholder-contact"
      ).href
    ).toBe("/admin/settings/footer")
    // The live /about page misses alt text: "missing SEO or alt".
    expect(contentHealth).toMatchObject({ missing: 1, total: 1 })
  })

  it("loads the live content once per request and tags what it read", async () => {
    const cookie = await cookieFor("admin")
    const media = await insertMedia({ alt: "Calm room" })
    const about = await insertPage({
      path: "/about",
      document: heroDocument(media.id),
      published: true,
    })
    vi.mocked(listLiveEntities).mockClear()
    vi.mocked(cacheTag).mockClear()

    const response = await adminRequest("/dashboard", cookie)
    const body = await response.json()
    expect(body.seoHealth).not.toBeNull()
    expect(body.contentHealth.findings).toEqual(expect.any(Array))
    expect(vi.mocked(listLiveEntities)).toHaveBeenCalledTimes(1)
    const tagged = vi.mocked(cacheTag).mock.calls.flat()
    expect(tagged).toEqual(
      expect.arrayContaining([
        "routes",
        "articles",
        "media",
        "settings:seo",
        "settings:footer",
        "collection:faqs",
        `page:${about.id}`,
      ])
    )
  })

  it("a viewer gets the same gauge as an editor, without findings", async () => {
    const media = await insertMedia({ alt: "", filename: "bare.jpg" })
    await insertPage({
      path: "/about",
      document: heroDocument(media.id, "James works here"),
      published: true,
    })
    const viewer = await (
      await adminRequest("/dashboard", await cookieFor("viewer"))
    ).json()
    const editor = await (
      await adminRequest("/dashboard", await cookieFor("editor"))
    ).json()
    const { findings, findingsTotal, ...gauge } = viewer.contentHealth
    expect(findings).toBeNull()
    expect(findingsTotal).toBe(0)
    expect(editor.contentHealth).toMatchObject(gauge)
    expect(JSON.stringify(viewer)).not.toContain("James")
  })
})
