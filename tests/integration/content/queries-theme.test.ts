import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getThemeConfig } from "@/server/modules/content/queries"
import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  await getDb()
    .insert(settings)
    .values({ key: "theme", value: {} })
    .onConflictDoNothing()
})
afterAll(closeDb)

describe("getThemeConfig", () => {
  it("draft only when asked", async () => {
    await getDb()
      .update(settings)
      .set({ draft: { site: { brand: "#2f5f8a" } } })
      .where(eq(settings.key, "theme"))
    expect((await getThemeConfig()).site.brand).toBeNull()
    expect((await getThemeConfig(false)).site.brand).toBeNull()
    expect((await getThemeConfig(true)).site.brand).toMatch(/^oklch\(/)
  })

  it("falls back to the published theme when there is no draft", async () => {
    expect((await getThemeConfig(true)).site.preset).toBe("teal-sage")
  })
})
