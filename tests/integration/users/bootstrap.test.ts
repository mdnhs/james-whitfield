import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import { createOwner } from "@/server/modules/users/bootstrap"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

describe("createOwner", () => {
  it("creates an owner without a password and emails the set-password link", async () => {
    await createOwner({ email: "Magda@Example.ie", name: "Magda Kennedy" })

    const user = await getDb().query.users.findFirst({
      where: eq(users.email, "magda@example.ie"),
    })
    expect(user?.role).toBe("owner")
    expect(readOutbox()[0].subject).toBe(
      "You're invited to the Magda Kennedy admin"
    )
  })

  it("refuses to run twice for the same email", async () => {
    await createOwner({ email: "magda@example.ie", name: "Magda" })
    await expect(
      createOwner({ email: "magda@example.ie", name: "Magda" })
    ).rejects.toThrow(/already has an account/)
  })
})
