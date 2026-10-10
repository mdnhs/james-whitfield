import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.describe("as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("shows the board, the table and the spam folder", async ({ page }) => {
    await page.goto("/admin/leads")
    await expect(
      page.getByRole("heading", { level: 1, name: "Enquiries" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Privacy request" })
    ).toBeVisible()
    for (const name of ["New", "Contacted", "Booked", "Closed"]) {
      await expect(page.getByRole("list", { name, exact: true })).toBeVisible()
    }

    await page.getByRole("button", { name: "Table", exact: true }).click()
    await expect(page).toHaveURL(/[?&]view=table/)

    await page.getByRole("tab", { name: "Spam" }).click()
    await expect(page).toHaveURL(/[?&]folder=spam/)
    await expect(page.getByLabel("Search enquiries")).toBeVisible()
  })

  test("opens the privacy request dialog", async ({ page }) => {
    await page.goto("/admin/leads")
    await page.getByRole("button", { name: "Privacy request" }).click()
    const dialog = page.getByRole("dialog", { name: "Privacy request" })
    await expect(dialog.getByLabel("Email address")).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Download data" })
    ).toBeDisabled()
  })
})

test.describe("as intake", () => {
  test.use({ storageState: STORAGE.intake })

  test("sees enquiries without export or privacy tools", async ({ page }) => {
    await page.goto("/admin/leads")
    await expect(
      page.getByRole("heading", { level: 1, name: "Enquiries" })
    ).toBeVisible()
    await expect(page.getByLabel("Search enquiries")).toBeVisible()
    await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Privacy request" })
    ).toHaveCount(0)
  })
})
