import { type Page } from "@playwright/test"

import { E2E_USERS, PASSWORD } from "../fixtures/users"
import { latestEmail } from "./mailpit"

export { E2E_USERS, PASSWORD }

// Fills and submits the sign-in form on the current page.
export async function signIn(
  page: Page,
  user: { email: string },
  password = PASSWORD
) {
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

// The newest link to `/api/auth/reset-password/…` emailed to `to` after
// `since`. Polls, because delivery happens after the response.
export async function emailedResetLink(to: string, since: Date) {
  const { Text } = await latestEmail(`to:"${to}"`, since)
  return Text.match(/https?:\/\/\S+\/api\/auth\/reset-password\/\S+/)![0]
}

// Signs out through the user menu (the topbar's avatar block).
export async function signOut(page: Page) {
  await page.getByRole("button", { name: /^Account menu for / }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
}
