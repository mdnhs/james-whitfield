import { eq } from "drizzle-orm"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"
import * as auditModule from "@/server/lib/audit"
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

describe("createOwner audit and duplicates", () => {
  it("writes a user.bootstrap-owner audit row", async () => {
    const { userId } = await createOwner({ email: "a@example.ie", name: "A" })
    const rows = await getDb().query.auditLogs.findMany({
      where: eq(auditLogs.action, "user.bootstrap-owner"),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].entityId).toBe(userId)
  })

  it("rejects a mixed-case duplicate", async () => {
    await createOwner({ email: "owner@example.ie", name: "O" })
    await expect(
      createOwner({ email: "Owner@Example.ie", name: "O" })
    ).rejects.toThrow(/already has an account/)
  })

  it("still resolves and warns when the audit write fails", async () => {
    const spy = vi
      .spyOn(auditModule, "audit")
      .mockRejectedValue(new Error("boom"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(
      createOwner({ email: "b@example.ie", name: "B" })
    ).resolves.toHaveProperty("userId")
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("audit entry failed"),
      "boom"
    )
    spy.mockRestore()
    warn.mockRestore()
  })
})
