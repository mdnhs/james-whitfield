import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.describe("as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("shows every Evergreen component on sample data", async ({ page }) => {
    await page.goto("/admin/design")
    await expect(
      page.getByRole("heading", { level: 1, name: "Design system" })
    ).toBeVisible()
    const sample = page.getByRole("region", { name: "Dashboard sample" })
    await expect(sample.getByRole("article")).toHaveCount(4)
    await expect(
      sample.getByRole("heading", { name: "Enquiries this week" })
    ).toBeVisible()
    await expect(sample.locator(".recharts-surface").first()).toBeVisible()
    await expect(
      sample.getByRole("heading", { name: "Content health" })
    ).toBeVisible()
  })
})

test.describe("as an editor", () => {
  test.use({ storageState: STORAGE.editor })

  test("is not allowed in", async ({ page }) => {
    await page.goto("/admin/design")
    await expect(
      page.getByRole("heading", {
        name: "You don't have access to Design system",
      })
    ).toBeVisible()
  })
})
