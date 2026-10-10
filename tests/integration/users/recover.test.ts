import { eq, or } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions, twoFactors, users } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import { recoverOwner, RecoveryError } from "@/server/modules/users/recover"

import {
  createUser,
  signIn,
  signInWithTwoFactor,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  clearOutbox()
})
afterAll(closeDb)

describe("recoverOwner (runbook: recover the owner account)", () => {
  it("resets two-factor, lifts a ban, ends every session and emails a reset link", async () => {
    const owner = await createUser("owner", "Boss@Example.com".toLowerCase())
    const viewer = await createUser("viewer")
    const cookie = await signInWithTwoFactor("boss@example.com")
    await viewAs(cookie, viewer.id)
    await getDb()
      .insert(twoFactors)
      .values({ userId: owner.id, secret: "s", backupCodes: "c" })
    await getDb()
      .update(users)
      .set({ banned: true, banReason: "test", twoFactorEnabled: true })
      .where(eq(users.id, owner.id))

    const result = await recoverOwner("  BOSS@example.com ")

    expect(result.userId).toBe(owner.id)
    expect(result.sessionsEnded).toBeGreaterThanOrEqual(2)
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, owner.id))
    expect(row).toMatchObject({
      banned: false,
      banReason: null,
      twoFactorEnabled: false,
    })
    expect(
      await getDb()
        .select()
        .from(twoFactors)
        .where(eq(twoFactors.userId, owner.id))
    ).toEqual([])
    expect(
      await getDb()
        .select()
        .from(sessions)
        .where(
          or(
            eq(sessions.userId, owner.id),
            eq(sessions.impersonatedBy, owner.id)
          )
        )
    ).toEqual([])
    const [entry] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "user.recover"))
    expect(entry).toMatchObject({ actorId: null, entityId: owner.id })
    expect(readOutbox().at(-1)?.to).toContain("boss@example.com")
    // The password still works; the panel then sends them to two-factor setup.
    expect(await signIn("boss@example.com")).toMatch(/mk\.session_token=/)
  })

  it("refuses an unknown email and a non-owner", async () => {
    await createUser("admin")
    await expect(recoverOwner("nobody@example.com")).rejects.toBeInstanceOf(
      RecoveryError
    )
    await expect(recoverOwner("admin@example.com")).rejects.toThrow(
      /not an owner/
    )
  })
})
