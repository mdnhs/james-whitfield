import { expect, test as setup } from "@playwright/test"
import { TOTP } from "otpauth"

import { E2E_ORIGIN } from "../fixtures/env"
import { E2E_USERS, PASSWORD, signIn } from "../support/admin"
import { resetTwoFactor } from "../support/db"
import { STORAGE } from "../support/storage"

const PLAIN = [
  ["editor", E2E_USERS.editor],
  ["intake", E2E_USERS.intake],
  ["viewer", E2E_USERS.viewer],
  ["account", E2E_USERS.accountUser],
] as const

for (const [key, user] of PLAIN) {
  setup(`signed in as ${user.role} (${key})`, async ({ page }) => {
    await page.goto("/admin/sign-in")
    await signIn(page, user)
    await expect(page).toHaveURL(/\/admin$/)
    await page.context().storageState({ path: STORAGE[key] })
  })
}

// Owners must use 2FA (docs/brief.md §7.4). Enrol through Better Auth's own
// endpoints rather than the UI (the UI flow is covered by two-factor.spec).
setup("signed in as an owner with two-factor", async ({ page }) => {
  const user = E2E_USERS.shellOwner
  await resetTwoFactor(user.email)
  await page.goto("/admin/sign-in")
  await signIn(page, user)
  await expect(page).toHaveURL(/\/admin\/two-factor-setup$/)

  const headers = { origin: E2E_ORIGIN }
  const enable = await page.request.post("/api/auth/two-factor/enable", {
    data: { password: PASSWORD },
    headers,
  })
  expect(enable.ok()).toBe(true)
  const { totpURI } = (await enable.json()) as { totpURI: string }
  const secret = new URL(totpURI).searchParams.get("secret") ?? ""
  const verify = await page.request.post("/api/auth/two-factor/verify-totp", {
    data: { code: new TOTP({ secret, digits: 6, period: 30 }).generate() },
    headers,
  })
  expect(verify.ok()).toBe(true)

  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin$/)
  await page.context().storageState({ path: STORAGE.owner })
})
