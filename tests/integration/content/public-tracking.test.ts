import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { cacheTag } from "next/cache"

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { getPublicTracking } from "@/server/modules/tracking/public"

import { resetDb } from "../helpers/db"

const write = (value: unknown) =>
  getDb()
    .insert(settings)
    .values({ key: "tracking", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })

beforeEach(resetDb)
afterAll(closeDb)

describe("getPublicTracking", () => {
  it("returns enabled, valid IDs only, and never the token", async () => {
    await write({
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      metaPixelId: "1234567890",
      capiTokenEncrypted: "v1.SECRET.SECRET.SECRET",
      testEventCode: "TEST123",
      enabled: { gtm: true, ga4: true, meta: true, capi: true },
    })
    const result = await getPublicTracking()
    expect(result).toEqual({
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      pixelId: "1234567890",
    })
    expect(JSON.stringify(result)).not.toMatch(/SECRET|TEST123/)
    expect(cacheTag).toHaveBeenCalledWith("settings:tracking")
  })

  it("nulls disabled channels, GA4 without GTM, and a missing row", async () => {
    await write({
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      metaPixelId: "1234567890",
      enabled: { gtm: false, ga4: true, meta: false },
    })
    expect(await getPublicTracking()).toEqual({
      gtmId: null,
      ga4Id: null,
      pixelId: null,
    })
    await resetDb()
    expect(await getPublicTracking()).toEqual({
      gtmId: null,
      ga4Id: null,
      pixelId: null,
    })
  })
})
