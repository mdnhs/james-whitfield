import { expect, test } from "@playwright/test"
import { TOTP } from "otpauth"

import { E2E_ORIGIN } from "../../fixtures/env"
import { E2E_USERS, PASSWORD, signIn, signOut } from "../../support/admin"
import { resetTwoFactor } from "../../support/db"

const GREETING = /^Good (morning|afternoon|evening), /

// A shared front-desk machine: one person signs out, the next signs in on
// the same tab. Nothing of the first may reach the second, not the query
// cache and not the routes Cache Components keeps hidden in <Activity>.
test("signing out leaves nothing of that user for the next one", async ({
  page,
}) => {
  const owner = E2E_USERS.handoverOwner
  await resetTwoFactor(owner.email)
  await page.goto("/admin/sign-in")
  await signIn(page, owner)
  await expect(page).toHaveURL(/\/admin\/two-factor-setup$/)
  // Enrol through Better Auth directly (the UI flow is two-factor.spec's).
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

  // The owner's dashboard, with the details only owners and admins get.
  await page.goto("/admin")
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toHaveText(/, Hana$/)
  const security = page.getByRole("region", { name: "Security health" })
  await expect(security).toBeVisible()
  const team = page.getByRole("region", { name: "Team activity" })
  await expect(team).toBeVisible()

  // The activity log through client navigation, so the route is kept (hidden)
  // once the owner moves on, with the owner's own sign-in among its rows
  // (rows name the actor).
  const nav = page.getByRole("navigation", { name: "Main" })
  await nav.getByRole("link", { name: "Activity log" }).click()
  const log = page.getByRole("table").getByRole("row")
  await expect(log.filter({ hasText: owner.name }).first()).toBeVisible()
  await nav.getByRole("link", { name: "Dashboard" }).click()
  await expect(security).toBeVisible()

  await signOut(page)
  await expect(page).toHaveURL(/\/admin\/sign-in$/)
  await signIn(page, E2E_USERS.editor)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toHaveText(/, Eddie$/)
  // The editor's view: aggregates only, on first paint and after it.
  await expect(page.getByRole("heading", { name: "Next up" })).toBeVisible()
  await expect(security).toHaveCount(0)
  await expect(team).toHaveCount(0)
  // Nothing hidden either: no activity log route, no owner rows, no owner.
  // (Charts keep their own screen-reader <table>; the log is a data table.)
  await expect(page.locator('[data-slot="table"]')).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Activity log", includeHidden: true })
  ).toHaveCount(0)
  expect(await page.content()).not.toContain(owner.email)
  expect(await page.content()).not.toContain(owner.name)
})
