import { expect, test } from "@playwright/test"

import {
  RATE_LIMITED,
  UNREACHABLE,
} from "../../../admin/modules/auth/auth-errors"
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

test("a failed reset request is not reported as sent", async ({ page }) => {
  let status = 429
  await page.route("**/api/auth/request-password-reset", (route) =>
    route.fulfill({ status, json: { message: "nope" } })
  )
  await page.goto("/admin/forgot-password")
  await page.getByLabel("Email").fill(user.email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByText(RATE_LIMITED)).toBeVisible()

  status = 503
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByText(UNREACHABLE)).toBeVisible()
  await expect(page.getByText("Check your inbox")).toHaveCount(0)
})

test("a short password is flagged on the password field", async ({ page }) => {
  await page.goto("/admin/reset-password?token=not-checked-client-side")
  const password = page.getByLabel("New password")
  const confirm = page.getByLabel("Repeat password")
  await password.fill("short")
  await confirm.fill("short")
  await page.getByRole("button", { name: "Update password" }).click()

  const passwordField = page.getByRole("group").filter({ has: password })
  await expect(passwordField.getByRole("alert")).toHaveText(
    "Use at least 12 characters."
  )
  await expect(password).toHaveAttribute("aria-invalid", "true")
  await expect(confirm).not.toHaveAttribute("aria-invalid", "true")
})
