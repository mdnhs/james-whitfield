import { expect, test } from "@playwright/test"

import { E2E_USERS, emailedResetLink, signIn } from "../support/admin"

const user = E2E_USERS.resetter
const NEW_PASSWORD = "a-brand-new-password-42"

test("a forgotten password is reset from the emailed link", async ({
  page,
}) => {
  await page.goto("/admin/sign-in")
  await page.getByRole("link", { name: "Forgot password?" }).click()
  await expect(page).toHaveURL(/\/admin\/forgot-password$/)

  const since = new Date(Date.now() - 1000)
  await page.getByLabel("Email").fill(user.email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("status")).toContainText("Check your inbox")

  await page.goto(await emailedResetLink(user.email, since))
  await expect(page).toHaveURL(/\/admin\/reset-password\?.*token=/)
  await expect(
    page.getByRole("heading", { name: "Set a new password" })
  ).toBeVisible()

  await page.getByLabel("New password").fill(NEW_PASSWORD)
  await page.getByLabel("Repeat password").fill("something-else-entirely")
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page.getByText("The two passwords don't match.")).toBeVisible()

  await page.getByLabel("Repeat password").fill(NEW_PASSWORD)
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in$/)
  await expect(page.getByText("Password updated.")).toBeVisible()

  await signIn(page, user, NEW_PASSWORD)
  await expect(
    page.getByRole("heading", { name: `Welcome, ${user.name}` })
  ).toBeVisible()
})

test("a broken reset link explains what to do", async ({ page }) => {
  await page.goto("/admin/reset-password?error=INVALID_TOKEN")
  await expect(
    page.getByRole("heading", { name: "This link no longer works" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Ask for a new link" })
  ).toHaveAttribute("href", "/admin/forgot-password")
})
