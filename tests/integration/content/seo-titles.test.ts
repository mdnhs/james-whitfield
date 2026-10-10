import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { parseGlobal } from "@/lib/content/globals"
import { documentTitle } from "@/lib/seo/title"
import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { isIndexable, listLiveEntities } from "@/server/modules/seo/live"

import { resetDb } from "../helpers/db"

beforeAll(async () => {
  await resetDb()
  await seedContent()
})
afterAll(closeDb)

describe("seeded site", () => {
  it("has a unique <title> for every URL in the sitemap", async () => {
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "seo"))
    const seo = parseGlobal("seo", row?.value)
    const live = (await listLiveEntities()).filter(isIndexable)
    expect(live.length).toBeGreaterThan(6)
    const titles = live.map((e) =>
      documentTitle(
        { home: e.home, title: e.title, seoTitle: e.seo.title },
        seo
      )
    )
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i)
    expect(dupes).toEqual([])
  })

  it("lists the published system pages and articles, not drafts", async () => {
    const paths = (await listLiveEntities()).map((e) => e.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/about",
        "/services",
        "/insights",
        "/contact",
        "/insights/calm-is-a-skill",
      ])
    )
    expect(paths).not.toContain("/privacy")
  })
})
