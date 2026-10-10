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
    for (const name of [
      "Enquiries this week",
      "Next up",
      "Team activity",
      "Content health",
    ]) {
      await expect(page.getByRole("region", { name })).toBeVisible()
    }
    const activity = page.getByRole("region", { name: "Team activity" })
    // Newest eight entries: parallel content specs can push the sign-ins out.
    await expect(activity.getByText("No activity yet")).toHaveCount(0)
    await expect(activity.getByText(/ago|just now/i).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "New article" })).toBeVisible()
    await expect(
      page.getByRole("list", { name: "Setup checklist" }).getByRole("listitem")
    ).toHaveCount(2)
  })
})

test.describe("as a viewer", () => {
  test.use({ storageState: STORAGE.viewer })

  test("sees aggregates and no edit actions", async ({ page }) => {
    await page.goto("/admin")
    await expect(
      page.getByRole("heading", { level: 1, name: GREETING })
    ).toBeVisible()
    await expect(page.getByRole("article")).toHaveCount(4)
    await expect(page.getByRole("link", { name: "New article" })).toHaveCount(0)
    await expect(
      page.getByRole("region", { name: "Team activity" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("region", { name: "Content health" })
    ).toBeVisible()
    await expect(
      page.getByRole("list", { name: "Content findings" }).getByRole("listitem")
    ).toHaveCount(0)
    // Its one step is the headline, so there is no checklist to repeat it.
    await expect(page.getByRole("heading", { name: "Next up" })).toBeVisible()
    await expect(page.getByText("Turn on two-factor")).toHaveCount(1)
    await expect(
      page.getByRole("list", { name: "Setup checklist" })
    ).toHaveCount(0)
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

test.describe("as intake", () => {
  test.use({ storageState: STORAGE.intake })

  test("sees only the figures it may open", async ({ page }) => {
    await page.goto("/admin")
    await expect(
      page.getByRole("heading", { level: 1, name: GREETING })
    ).toBeVisible()
    await expect(page.getByRole("article")).toHaveCount(3)
    await expect(
      page.getByRole("region", { name: "Content health" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("region", { name: "Team activity" })
    ).toHaveCount(0)
  })
})

test.describe("as an editor", () => {
  test.use({ storageState: STORAGE.editor })

  test("opens the new-article dialog from the dashboard", async ({ page }) => {
    await page.goto("/admin")
    await page.getByRole("link", { name: "New article" }).click()
    await expect(page).toHaveURL(/\/admin\/insights\?new=1$/)
    await expect(
      page.getByRole("dialog", { name: "New article" })
    ).toBeVisible()
  })
})
