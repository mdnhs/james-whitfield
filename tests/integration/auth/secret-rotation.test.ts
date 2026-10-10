import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { getAuth, resetAuthForTests } from "@/server/auth/auth"
import { closeDb } from "@/server/db/client"
import { resetEnvForTests } from "@/server/env"

import { adminRequest, createUser, PASSWORD, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { authPost, enrolTotp, mergeCookies } from "../helpers/two-factor"

const NEW = "n".repeat(20) + "0123456789abcdefghijklmnop"

beforeEach(resetDb)
afterEach(() => {
  delete process.env.BETTER_AUTH_SECRETS
  resetEnvForTests()
  resetAuthForTests()
})
afterAll(closeDb)

function rotate() {
  process.env.BETTER_AUTH_SECRETS = `2:${NEW}`
  resetEnvForTests()
  resetAuthForTests()
}

describe("BETTER_AUTH_SECRETS rotation (Ruling R17)", () => {
  it("signs everyone out but keeps two-factor working", async () => {
    await createUser("editor", "ed@example.com")
    const { cookie, totp } = await enrolTotp(await signIn("ed@example.com"))

    rotate()

    // Session cookies were signed with the old secret.
    expect((await adminRequest("/me", cookie)).status).toBe(401)
    // A password sign-in opens the 2FA challenge…
    const challenge = await getAuth().api.signInEmail({
      body: { email: "ed@example.com", password: PASSWORD },
      asResponse: true,
    })
    const pending = mergeCookies("", challenge.headers.getSetCookie())
    // …and the TOTP secret encrypted under the old key still decrypts.
    const verify = await authPost("/two-factor/verify-totp", pending, {
      code: totp.generate(),
    })
    expect(verify.status).toBe(200)
    const fresh = mergeCookies(pending, verify.headers.getSetCookie())
    expect((await adminRequest("/me", fresh)).status).toBe(200)
  })
})
