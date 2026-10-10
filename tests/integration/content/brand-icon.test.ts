import { eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { media, settings } from "@/server/db/schema"
import { brandIcon } from "@/server/modules/theme/icons"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

async function useIcon(
  url: string,
  extra: Partial<typeof media.$inferInsert> = {}
) {
  const [row] = await getDb()
    .insert(media)
    .values({
      driver: "static",
      key: `static${url}`,
      url,
      filename: url.split("/").pop()!,
      mimeType: url.endsWith(".svg") ? "image/svg+xml" : "image/png",
      sizeBytes: 1,
      width: 100,
      height: 100,
      ...extra,
    })
    .returning()
  const value = { icon: { mediaId: row!.id } }
  await getDb()
    .insert(settings)
    .values({ key: "site", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
  return row!
}

describe("brandIcon", () => {
  it("renders a static SVG as a square PNG", async () => {
    await useIcon("/images/hero/logo-mark.svg")
    const png = await brandIcon(192)
    const meta = await sharp(Buffer.from(png!)).metadata()
    expect(meta).toMatchObject({ format: "png", width: 192, height: 192 })
  })

  it("pads a wide image into a square PNG", async () => {
    // A 1740×1160 PNG that ships under public/.
    await useIcon("/images/how-it-works/step-3.png", {
      width: 1740,
      height: 1160,
    })
    const png = await brandIcon(32)
    const meta = await sharp(Buffer.from(png!)).metadata()
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([32, 32, true])
  })

  it("404s a deleted or unreadable icon", async () => {
    const row = await useIcon("/images/does-not-exist.png")
    expect(await brandIcon(32)).toBeNull()
    await getDb()
      .update(media)
      .set({ deletedAt: new Date(), url: "/images/hero/logo-mark.svg" })
      .where(eq(media.id, row.id))
    expect(await brandIcon(32)).toBeNull()
  })
})
