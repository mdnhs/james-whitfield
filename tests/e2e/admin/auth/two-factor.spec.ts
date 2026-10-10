import { expect, test, type Page } from "@playwright/test"
import { TOTP } from "otpauth"

import {
  E2E_USERS,
  PASSWORD,
  signIn,
  signOut as signOutFromMenu,
} from "../../support/admin"
import { resetTwoFactor } from "../../support/db"

const SETUP = /\/admin\/two-factor-setup$/
// The verify step exactly, never /admin/two-factor-setup.
const VERIFY = /\/admin\/two-factor\?next=%2Fadmin$/
const PANEL = /\/admin$/
const SECURITY = /\/admin\/account\?tab=security$/

async function signInFresh(page: Page, user: { email: string }) {
  await page.goto("/admin/sign-in")
  await signIn(page, user)
}

async function signOut(page: Page) {
  await signOutFromMenu(page)
  await expect(page).toHaveURL(/\/admin\/sign-in/)
}

// Change 2026-10-11 (product owner): two-factor is optional for every role,
// owners included. Once it is on, sign-in still asks for the code.
test.describe("an owner who sets up two-factor", () => {
  const user = E2E_USERS.twoFactorOwner
  // Both tests change the same account, so they never overlap.
  test.describe.configure({ mode: "serial" })
  // Self-contained: a rerun or retry starts from "no two-factor" again.
  test.beforeEach(() => resetTwoFactor(user.email))

  test("turns it on from Security, is challenged at sign-in (code, backup code, trusted device), then turns it off", async ({
    page,
  }) => {
    await signInFresh(page, user)
    // Not forced: straight into the panel, and offered it from Security.
    await expect(page).toHaveURL(PANEL)
    await page.goto("/admin/account?tab=security")
    await page.getByRole("link", { name: "Set up two-factor" }).click()
    await expect(page).toHaveURL(SETUP)

    await page.getByRole("textbox", { name: "Current password" }).fill(PASSWORD)
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
      page.getByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Tess$/,
      })
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
      page.getByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Tess$/,
      })
    ).toBeVisible()

    // An owner may turn it off, with their password.
    await page.goto("/admin/account?tab=security")
    await expect(page).toHaveURL(SECURITY)
    await page.getByRole("button", { name: "Turn off" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Password").fill(PASSWORD)
    await dialog.getByRole("button", { name: "Turn off two-factor" }).click()
    await expect(
      page.getByText("Two-factor authentication is off")
    ).toBeVisible()
    const me = await page.request.get("/api/v1/admin/me")
    expect((await me.json()).twoFactorEnabled).toBe(false)
    await expect(
      page.getByRole("link", { name: "Set up two-factor" })
    ).toBeVisible()
  })

  test("a wrong code is refused", async ({ page }) => {
    await signInFresh(page, user)
    await expect(page).toHaveURL(PANEL)
    await page.goto("/admin/two-factor-setup")
    await expect(page).toHaveURL(SETUP)
    await page.getByRole("textbox", { name: "Current password" }).fill(PASSWORD)
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByLabel("6-digit code").fill("000000")
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.getByText("That code didn't work.")).toBeVisible()
  })
})

test("an owner without two-factor signs in straight to the panel", async ({
  page,
}) => {
  const owner = E2E_USERS.owner
  await resetTwoFactor(owner.email)
  await signInFresh(page, owner)
  await expect(page).toHaveURL(PANEL)

  // Deep links open too: no redirect to setup.
  for (const path of ["/admin", "/admin/activity"]) {
    await page.goto(path)
    expect(new URL(page.url()).pathname).toBe(path)
  }
  expect((await page.request.get("/api/v1/admin/audit")).status()).toBe(200)

  // A recommendation, with the reason for an owner, linking to Security.
  await page.goto("/admin")
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^Good (morning|afternoon|evening)/,
    })
  ).toBeVisible()
  await expect(
    page.getByText("Turn on two-factor authentication").first()
  ).toBeVisible()
  await expect(
    page.getByText(/^Strongly recommended for your role/)
  ).toBeVisible()
  await page.getByRole("link", { name: "Open security settings" }).click()
  await expect(page).toHaveURL(SECURITY)
  // The dashboard stays in the DOM, hidden (<Activity>): visible text only.
  await expect(
    page
      .getByText(/Strongly recommended for your role/)
      .filter({ visible: true })
  ).toBeVisible()
})
