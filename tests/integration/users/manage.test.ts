import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"

import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { activeOwnersExcept } from "@/server/modules/users/manage"

import { createUser } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("activeOwnersExcept", () => {
  it("counts only unbanned or ban-expired owners, multi-role included", async () => {
    const a = await createUser("owner", "a@example.com")
    const b = await createUser("owner", "b@example.com")
    const c = await createUser("owner", "c@example.com")
    const d = await createUser("editor", "d@example.com")
    const db = getDb()
    await db
      .update(users)
      .set({ role: "editor,owner" })
      .where(eq(users.id, d.id))
    // b: banned for good; c: a ban that ended yesterday.
    await db.update(users).set({ banned: true }).where(eq(users.id, b.id))
    await db
      .update(users)
      .set({ banned: true, banExpires: new Date(Date.now() - 86_400_000) })
      .where(eq(users.id, c.id))

    expect(await activeOwnersExcept(db, a.id)).toBe(2) // c, d
    expect(await activeOwnersExcept(db, d.id)).toBe(2) // a, c
  })
})
