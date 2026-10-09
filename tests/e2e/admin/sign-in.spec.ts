import { expect, test } from "@playwright/test"

import { E2E_USERS, signIn } from "../support/admin"

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

test("an off-site next is ignored after signing in", async ({ page }) => {
  await page.goto("/admin/sign-in?next=https%3A%2F%2Fevil.example%2Fadmin")
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin$/)
})

test("a signed-in visit to sign-in skips straight to next", async ({
  page,
}) => {
  await page.goto("/admin/sign-in")
  await signIn(page, E2E_USERS.owner)
  await expect(
    page.getByRole("heading", welcome(E2E_USERS.owner.name))
  ).toBeVisible()
  await page.goto("/admin/sign-in?next=%2Fadmin%3Fwelcome%3D1")
  await expect(page).toHaveURL(/\/admin\?welcome=1$/)
  await expect(
    page.getByRole("heading", welcome(E2E_USERS.owner.name))
  ).toBeVisible()
})
