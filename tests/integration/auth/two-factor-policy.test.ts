import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"

import {
  cookieFor,
  createUser,
  PASSWORD,
  signIn,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { authPost, enrolTotp } from "../helpers/two-factor"

beforeEach(resetDb)
afterAll(closeDb)

const audited = async (action: string) =>
  getDb().select().from(auditLogs).where(eq(auditLogs.action, action))
const flag = async (email: string) =>
  (await getDb().query.users.findFirst({ where: eq(users.email, email) }))!
    .twoFactorEnabled

describe("two-factor policy", () => {
  it("audits enrolment once", async () => {
    await createUser("editor", "ed@example.com")
    await enrolTotp(await signIn("ed@example.com"))
    expect(await audited("account.two_factor_enable")).toHaveLength(1)
  })

  it("lets an editor turn two-factor off, audited", async () => {
    await createUser("editor", "ed@example.com")
    const { cookie } = await enrolTotp(await signIn("ed@example.com"))
    const response = await authPost("/two-factor/disable", cookie, {
      password: PASSWORD,
    })
    expect(response.status).toBe(200)
    expect(await flag("ed@example.com")).toBe(false)
    expect(await audited("account.two_factor_disable")).toHaveLength(1)
  })

  it.each(["owner", "admin"] as const)(
    "never lets an %s turn it off",
    async (role) => {
      await createUser(role, `${role}@example.com`)
      const { cookie } = await enrolTotp(await signIn(`${role}@example.com`))
      const response = await authPost("/two-factor/disable", cookie, {
        password: PASSWORD,
      })
      expect(response.status).toBe(403)
      expect((await response.json()).code).toBe("TWO_FACTOR_MANDATORY")
      expect(await flag(`${role}@example.com`)).toBe(true)
    }
  )

  it("regenerates backup codes for anyone with 2FA, audited", async () => {
    await createUser("owner", "owner@example.com")
    const { cookie, backupCodes } = await enrolTotp(
      await signIn("owner@example.com")
    )
    const response = await authPost(
      "/two-factor/generate-backup-codes",
      cookie,
      {
        password: PASSWORD,
      }
    )
    expect(response.status).toBe(200)
    const { backupCodes: fresh } = (await response.json()) as {
      backupCodes: string[]
    }
    expect(fresh).toHaveLength(10)
    expect(fresh).not.toEqual(backupCodes)
    expect(await audited("account.backup_codes_regenerate")).toHaveLength(1)
  })

  it("refuses two-factor changes while viewing as someone", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = await viewAs(owner, editor.id)
    for (const path of [
      "/two-factor/enable",
      "/two-factor/disable",
      "/two-factor/generate-backup-codes",
    ]) {
      const response = await authPost(path, viewing, { password: PASSWORD })
      expect(response.status, path).toBe(403)
      expect((await response.json()).code, path).toBe("IMPERSONATION_READ_ONLY")
    }
  })

  it("a wrong password changes nothing and audits nothing", async () => {
    await createUser("editor", "ed@example.com")
    const { cookie } = await enrolTotp(await signIn("ed@example.com"))
    const response = await authPost("/two-factor/disable", cookie, {
      password: "wrong password!!",
    })
    expect(response.ok).toBe(false)
    expect(await flag("ed@example.com")).toBe(true)
    expect(await audited("account.two_factor_disable")).toHaveLength(0)
  })
})
