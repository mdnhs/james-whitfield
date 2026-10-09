import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

const GREETING = /^Good (morning|afternoon|evening), /

test.describe("as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("shows every widget the role may see", async ({ page }) => {
    await page.goto("/admin")
    await expect(
      page.getByRole("heading", { level: 1, name: GREETING })
    ).toHaveText(/, Sam$/)
    await expect(page.getByRole("article")).toHaveCount(4)
    await expect(
      page.getByRole("heading", { name: "Security health" }).first()
    ).toBeVisible()
    const activity = page.getByRole("region", { name: "Team activity" })
    await expect(activity.getByText("Signed in").first()).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Invite teammate" })
    ).toBeVisible()
  })
})

test.describe("as a viewer", () => {
  test.use({ storageState: STORAGE.viewer })

  test("sees aggregates and no edit actions", async ({ page }) => {
    await page.goto("/admin")
    await expect(
      page.getByRole("heading", { level: 1, name: GREETING })
    ).toBeVisible()
    await expect(page.getByRole("article")).toHaveCount(2)
    await expect(
      page.getByRole("link", { name: "Invite teammate" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("region", { name: "Team activity" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("region", { name: "Security health" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("list", { name: "Setup checklist" })
    ).toBeVisible()
    // Two-factor is optional for a viewer: recommended, never "required".
    await expect(page.getByText(/^Recommended\./)).toBeVisible()
  })

  test("is offered two-factor, not told it is required", async ({ page }) => {
    await page.goto("/admin")
    await page.getByRole("link", { name: "Set up two-factor" }).click()
    await expect(page).toHaveURL(/\/admin\/two-factor-setup$/)
    await expect(page.getByText(/is recommended/)).toBeVisible()
    await expect(page.getByText(/is required/)).toHaveCount(0)
    await page.getByRole("link", { name: "Back to the dashboard" }).click()
    await expect(page).toHaveURL(/\/admin$/)
  })
})
