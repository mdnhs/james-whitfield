import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

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
})
