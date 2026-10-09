import { expect, test, type Browser } from "@playwright/test"

import { E2E_USERS, signIn } from "../../support/admin"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.account })
// Every test changes the same account.
test.describe.configure({ mode: "serial" })

// A second browser signed in as the account user, as another device.
async function otherDevice(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.accountUser)
  await expect(page).toHaveURL(/\/admin$/)
  return { context, page }
}

test("changes the display name and the shell follows", async ({ page }) => {
  await page.goto("/admin/account")
  const name = page.getByLabel("Full name")
  await name.fill("Andy Renamed")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(page.getByText("Profile saved")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Account menu for Andy Renamed" })
  ).toBeVisible()

  // Put it back so a rerun starts from the seed.
  await name.fill(E2E_USERS.accountUser.name)
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(
    page.getByRole("button", {
      name: `Account menu for ${E2E_USERS.accountUser.name}`,
    })
  ).toBeVisible()
})

test("refuses a mismatched new password before calling the server", async ({
  page,
}) => {
  await page.goto("/admin/account?tab=security")
  await page.getByLabel("Current password").fill("anything-at-all")
  await page
    .getByLabel("New password", { exact: true })
    .fill("a-long-new-password")
  await page.getByLabel("Confirm new password").fill("a-different-password")
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(page.getByText("The passwords don't match")).toBeVisible()
})

test("signs one other device out, never this one", async ({
  page,
  browser,
}) => {
  const other = await otherDevice(browser)

  await page.goto("/admin/account?tab=sessions")
  const devices = page.getByRole("list", { name: "Signed-in devices" })
  const current = devices.getByRole("listitem").filter({
    hasText: "This device",
  })
  await expect(current).toHaveCount(1)
  await expect(current.getByRole("button")).toHaveCount(0)
  // No IP addresses on screen, only a device summary.
  await expect(devices).not.toContainText(/\d{1,3}(\.\d{1,3}){3}|::1/)

  const before = await devices.getByRole("listitem").count()
  // The newest other device is the one just signed in.
  await devices
    .getByRole("listitem")
    .filter({ hasNotText: "This device" })
    .first()
    .getByRole("button", { name: /^Sign out/ })
    .click()
  await expect(page.getByText("Signed out of that device")).toBeVisible()
  await expect(devices.getByRole("listitem")).toHaveCount(before - 1)

  expect((await other.page.request.get("/api/v1/admin/me")).status()).toBe(401)
  await other.context.close()
})

test("signs every other device out", async ({ page, browser }) => {
  const other = await otherDevice(browser)

  await page.goto("/admin/account?tab=sessions")
  const devices = page.getByRole("list", { name: "Signed-in devices" })
  await expect(devices.getByText("This device")).toBeVisible()
  await page.getByRole("button", { name: "Sign out other devices" }).click()
  await expect(page.getByText("Signed out of your other devices")).toBeVisible()
  await expect(devices.getByRole("listitem")).toHaveCount(1)

  expect((await other.page.request.get("/api/v1/admin/me")).status()).toBe(401)
  await other.context.close()
})
