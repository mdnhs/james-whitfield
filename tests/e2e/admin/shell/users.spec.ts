import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.describe("as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("lists people, shows the role matrix and keeps the tab in the URL", async ({
    page,
  }) => {
    await page.goto("/admin/users")
    await expect(
      page.getByRole("heading", { level: 1, name: "Users & roles" })
    ).toBeVisible()
    await expect(
      page.getByRole("list", { name: "People" }).getByRole("listitem").first()
    ).toBeVisible()
    await page.getByRole("tab", { name: "Roles" }).click()
    await expect(page).toHaveURL(/[?&]tab=roles/)
    await expect(
      page.getByRole("table", { name: "What each role can do" })
    ).toBeVisible()
  })

  test("invites someone, changes their roles, then deletes them behind a named confirmation", async ({
    page,
  }) => {
    const stamp = Date.now()
    const name = `Invitee ${stamp}`
    const email = `invitee-${stamp}@e2e.test`
    await page.goto("/admin/users")
    await page.getByRole("button", { name: "Invite someone" }).click()
    await page.getByLabel("Name").fill(name)
    await page.getByLabel("Email").fill(email)
    await page.getByRole("button", { name: "Send invite" }).click()

    await page.getByRole("searchbox", { name: "Search people" }).fill(email)
    const row = page
      .getByRole("list", { name: "People" })
      .getByRole("listitem")
      .filter({ hasText: email })
    await expect(row).toContainText("Invite pending")

    await row.getByRole("button", { name: `Actions for ${name}` }).click()
    await page.getByRole("menuitem", { name: "Change roles" }).click()
    await page.getByRole("checkbox", { name: /Viewer/ }).click()
    await page.getByRole("button", { name: "Save roles" }).click()
    await expect(row).toContainText("Viewer")

    await row.getByRole("button", { name: `Actions for ${name}` }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    const dialog = page.getByRole("dialog", { name: `Delete ${name}?` })
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(row).toHaveCount(0)
  })
})

test.describe("as an editor", () => {
  test.use({ storageState: STORAGE.editor })

  test("is sent to no-access", async ({ page }) => {
    await page.goto("/admin/users")
    await expect(page).toHaveURL(/\/admin\/no-access/)
  })
})
