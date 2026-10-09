import { expect, test, type Page } from "@playwright/test"
import { TOTP } from "otpauth"

import { E2E_USERS, PASSWORD, signIn } from "../../support/admin"
import { resetTwoFactor } from "../../support/db"

const SETUP = /\/admin\/two-factor-setup$/
// The verify step exactly, never /admin/two-factor-setup.
const VERIFY = /\/admin\/two-factor\?next=%2Fadmin$/
const PANEL = /\/admin$/

async function signInFresh(page: Page, user: { email: string }) {
  await page.goto("/admin/sign-in")
  await signIn(page, user)
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in/)
}

test.describe("an owner who sets up two-factor", () => {
  const user = E2E_USERS.twoFactorOwner
  // Both tests change the same account, so they never overlap.
  test.describe.configure({ mode: "serial" })
  // Self-contained: a rerun or retry starts from "no two-factor" again.
  test.beforeEach(() => resetTwoFactor(user.email))

  test("must set it up, then signs in with a code, a backup code and a trusted device", async ({
    page,
  }) => {
    await signInFresh(page, user)
    await expect(page).toHaveURL(SETUP)

    await page.getByLabel("Current password", { exact: true }).fill(PASSWORD)
    await page.getByRole("button", { name: "Continue" }).click()
    const secret =
      (await page.getByTestId("totp-secret").textContent())?.trim() ?? ""
    const totp = new TOTP({ secret, digits: 6, period: 30 })

    await page.getByLabel("6-digit code").fill(totp.generate())
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(
      page.getByRole("heading", { name: "Save your backup codes" })
    ).toBeVisible()
    const backupCode = (
      await page
        .getByRole("list", { name: "Backup codes" })
        .getByRole("listitem")
        .first()
        .textContent()
    )?.trim()
    expect(backupCode).toBeTruthy()
    await page.getByRole("button", { name: "I've saved them" }).click()
    await expect(page).toHaveURL(PANEL)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${user.name}` })
    ).toBeVisible()
    expect((await page.request.get("/api/v1/admin/audit")).status()).toBe(200)

    // Authenticator code. The verify page sanitises its own ?next, so an
    // off-site value typed into the URL still lands in the panel.
    await signOut(page)
    await signIn(page, user)
    await expect(page).toHaveURL(VERIFY)
    await page.goto("/admin/two-factor?next=https%3A%2F%2Fevil.example%2Fadmin")
    // Next period's code: valid within the verification window and never a
    // replay of the code used during setup.
    await page
      .getByLabel("6-digit code")
      .fill(totp.generate({ timestamp: Date.now() + 30_000 }))
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page).toHaveURL(PANEL)

    // Backup code, trusting this device.
    await signOut(page)
    await signIn(page, user)
    await expect(page).toHaveURL(VERIFY)
    await page.getByRole("button", { name: "Use a backup code" }).click()
    await page.getByLabel("Backup code").fill(backupCode!)
    await page.getByRole("checkbox", { name: "Trust this device" }).click()
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page).toHaveURL(PANEL)

    // A trusted device skips the code.
    await signOut(page)
    await signIn(page, user)
    await expect(page).toHaveURL(PANEL)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${user.name}` })
    ).toBeVisible()
  })

  test("a wrong code is refused", async ({ page }) => {
    await signInFresh(page, user)
    await expect(page).toHaveURL(SETUP)
    await page.getByLabel("Current password", { exact: true }).fill(PASSWORD)
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByLabel("6-digit code").fill("000000")
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.getByText("That code didn't work.")).toBeVisible()
  })
})

test("an owner without two-factor cannot reach the panel or the admin API", async ({
  page,
}) => {
  const owner = E2E_USERS.owner
  await signInFresh(page, owner)
  await expect(page).toHaveURL(SETUP)

  // Any panel URL, deep links included, goes back to setup.
  for (const path of ["/admin", "/admin?tab=drafts"]) {
    await page.goto(path)
    await expect(page).toHaveURL(SETUP)
  }
  await expect(page.getByRole("heading", { name: /Welcome/ })).toHaveCount(0)

  // The API refuses on its own, whatever the client does.
  const audit = await page.request.get("/api/v1/admin/audit")
  expect(audit.status()).toBe(403)
  expect((await audit.json()).error.code).toBe("TWO_FACTOR_REQUIRED")
  // /me still answers, so a client can tell why.
  const me = await page.request.get("/api/v1/admin/me")
  expect(me.status()).toBe(200)
  expect((await me.json()).twoFactorEnabled).toBe(false)

  // The way out works.
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in/)
})
