import { expect, test } from "@playwright/test"

import {
  RATE_LIMITED,
  UNREACHABLE,
} from "../../../../admin/modules/auth/auth-errors"
import { E2E_ORIGIN } from "../../fixtures/env"
import { E2E_USERS, signIn } from "../../support/admin"

const welcome = (name: string) => ({ name: `Welcome, ${name}` })

test("a signed-out visit to /admin goes through sign-in and back", async ({
  page,
}) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/)
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(
    page.getByRole("heading", welcome(E2E_USERS.editor.name))
  ).toBeVisible()
})

test("a wrong password shows a generic error", async ({ page }) => {
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.editor, "not-the-password")
  await expect(
    page.getByText("That email and password don't match an account.")
  ).toBeVisible()
})

test("signing out returns to sign-in and the panel is gated again", async ({
  page,
}) => {
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.editor)
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in/)
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/sign-in/)
})

// The sign-in route stays mounted but hidden (<Activity>) after the first
// sign-in; coming back must find a usable form, not a pending one.
test("signing out and straight back in works", async ({ page }) => {
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin$/)
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in/)
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(
    page.getByRole("heading", welcome(E2E_USERS.editor.name))
  ).toBeVisible()
})

test("an off-site next is ignored after signing in", async ({ page }) => {
  await page.goto("/admin/sign-in?next=https%3A%2F%2Fevil.example%2Fadmin")
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin$/)
})

test("a signed-in visit to sign-in skips straight to next", async ({
  page,
}) => {
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.editor)
  await expect(
    page.getByRole("heading", welcome(E2E_USERS.editor.name))
  ).toBeVisible()
  await page.goto("/admin/sign-in?next=%2Fadmin%3Fwelcome%3D1")
  await expect(page).toHaveURL(/\/admin\?welcome=1$/)
  await expect(
    page.getByRole("heading", welcome(E2E_USERS.editor.name))
  ).toBeVisible()
})

test("a rate-limited sign-in says so instead of blaming the password", async ({
  page,
}) => {
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({ status: 429, json: { message: "Too many requests" } })
  )
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.editor)
  await expect(page.getByText(RATE_LIMITED)).toBeVisible()
  await expect(page.getByText("don't match an account")).toHaveCount(0)
})

test("a sign-in that cannot reach the server says so", async ({ page }) => {
  await page.route("**/api/auth/sign-in/email", (route) => route.abort())
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.editor)
  await expect(page.getByText(UNREACHABLE)).toBeVisible()
})

test("a deep link with a stale cookie returns there after sign-in", async ({
  page,
  context,
}) => {
  // Passes the proxy's cookie check, fails the panel's real session check.
  await context.addCookies([
    { name: "mk.session_token", value: "stale", url: E2E_ORIGIN },
  ])
  await page.goto("/admin?tab=drafts")
  await expect(page).toHaveURL(
    /\/admin\/sign-in\?next=%2Fadmin%3Ftab%3Ddrafts$/
  )
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin\?tab=drafts$/)
})
