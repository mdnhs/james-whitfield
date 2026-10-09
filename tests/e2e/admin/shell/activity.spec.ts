import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.describe("as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("filters by action, keeps the filter in the URL and across a reload", async ({
    page,
  }) => {
    await page.goto("/admin/activity")
    await expect(
      page.getByRole("heading", { level: 1, name: "Activity log" })
    ).toBeVisible()
    await page.getByRole("combobox", { name: "Action" }).click()
    await page.getByRole("option", { name: "auth.sign_in" }).click()
    await expect(page).toHaveURL(/[?&]action=auth\.sign_in/)

    // Below 640px the rows are cards; above it, a table.
    const cards = (page.viewportSize()?.width ?? 0) < 640
    const rows = cards
      ? page.getByRole("list", { name: "Activity log" }).getByRole("listitem")
      : page
          .getByRole("table")
          .getByRole("row")
          .filter({ has: page.locator("td") })
    await expect(rows.first()).toContainText("auth.sign_in")
    for (const text of await rows.allTextContents()) {
      expect(text).toContain("auth.sign_in")
    }

    await page.reload()
    await expect(page.getByRole("combobox", { name: "Action" })).toHaveText(
      "auth.sign_in"
    )
  })
})

test.describe("as an editor", () => {
  test.use({ storageState: STORAGE.editor })

  test("is not allowed in", async ({ page }) => {
    await page.goto("/admin/activity")
    await expect(
      page.getByRole("heading", {
        name: "You don't have access to Activity log",
      })
    ).toBeVisible()
  })
})
