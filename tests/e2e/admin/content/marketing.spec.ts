import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })

test("an owner saves tracking IDs; the token field stays empty after", async ({
  page,
}) => {
  await page.goto("/admin/marketing")
  const gtm = page.getByLabel("GTM container ID")
  await expect(gtm).toBeVisible()
  await gtm.fill("GTM-E2E1234")
  await page.getByRole("button", { name: "Save tracking" }).click()
  await expect(page.getByText("Tracking saved")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("GTM container ID")).toHaveValue("GTM-E2E1234")
  // No stored token is ever rendered into a field.
  await expect(page.locator("input[type=password]")).not.toHaveValue(/.+/)
  await expect(
    page.getByRole("heading", { name: "Enhanced matching" })
  ).toBeVisible()
})

test("the consent preview follows the Title field", async ({ page }) => {
  await page.goto("/admin/marketing/consent")
  const preview = page.getByRole("region", { name: "Preview" })
  await page.getByLabel("Title").fill("Preview heading e2e")
  await expect(
    preview.getByRole("heading", { name: "Preview heading e2e" })
  ).toBeVisible()
})
