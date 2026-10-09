import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("settings table", () => {
  it("stores and reads a JSON document by key", async () => {
    const db = getDb()
    await db
      .insert(settings)
      .values({ key: "site", value: { name: "Magda Kennedy" } })

    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "site"))

    expect(row.value).toEqual({ name: "Magda Kennedy" })
    expect(row.version).toBe(1)
    expect(row.updatedAt).toBeInstanceOf(Date)
  })
})
