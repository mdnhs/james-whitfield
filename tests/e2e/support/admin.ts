import { expect, type Page } from "@playwright/test"

import { MAILPIT_URL } from "../fixtures/env"
import { E2E_USERS, PASSWORD } from "../fixtures/users"

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

type MailpitSummary = { ID: string; Created: string }

// The newest link to `/api/auth/reset-password/…` emailed to `to` after
// `since`. Polls, because delivery happens after the response.
export async function emailedResetLink(to: string, since: Date) {
  let link: string | undefined
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`
        )
        const { messages } = (await search.json()) as {
          messages: MailpitSummary[]
        }
        const fresh = messages.find(
          (message) => new Date(message.Created) >= since
        )
        if (!fresh) return undefined
        const message = await fetch(`${MAILPIT_URL}/api/v1/message/${fresh.ID}`)
        const { Text } = (await message.json()) as { Text: string }
        link = Text.match(/https?:\/\/\S+\/api\/auth\/reset-password\/\S+/)?.[0]
        return link
      },
      { message: `reset email to ${to}`, timeout: 15_000 }
    )
    .toBeTruthy()
  return link!
}

// Signs out through the user menu (the topbar's avatar block).
export async function signOut(page: Page) {
  await page.getByRole("button", { name: /^Account menu for / }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
}
