// tests/e2e/admin/users/view-as.spec.ts
import { expect, test } from "@playwright/test"

import { E2E_USERS } from "../../support/admin"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })

// docs/plan.md Phase 10 acceptance: View as an editor hides admin-only
// navigation. The owner's own session is untouched: View-as runs on a new
// session and Stop viewing restores the original one.
test("View as an editor hides admin-only navigation, and Stop viewing restores it", async ({
  page,
}) => {
  const editor = E2E_USERS.editor
  await page.goto("/admin/users")
  await expect(
    page.getByRole("heading", { name: "Users & roles" })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Users & roles" })).toBeVisible()

  await page.getByRole("button", { name: `Actions for ${editor.name}` }).click()
  await page.getByRole("menuitem", { name: "View as" }).click()

  await page.waitForURL(/\/admin$/)
  await expect(
    page.getByRole("status").filter({ hasText: `Viewing as ${editor.name}` })
  ).toBeVisible()
  for (const name of [
    "Users & roles",
    "Activity log",
    "Appearance",
    "Enquiries",
    "Marketing",
  ]) {
    await expect(
      page.getByRole("link", { name, exact: true }),
      name
    ).toHaveCount(0)
  }
  await expect(
    page.getByRole("link", { name: "Pages", exact: true }).first()
  ).toBeVisible()
  // The API agrees with the navigation.
  expect((await page.request.get("/api/v1/admin/users")).status()).toBe(403)

  await page.getByRole("button", { name: "Stop viewing" }).click()
  await page.waitForURL(/\/admin\/users$/)
  await expect(
    page.getByRole("status").filter({ hasText: "Viewing as" })
  ).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Users & roles" })).toBeVisible()
})

test("the roles tab shows the generated matrix", async ({ page }) => {
  await page.goto("/admin/users?tab=roles")
  const matrix = page.getByRole("table", { name: "What each role can do" })
  await expect(
    matrix.getByRole("rowheader", { name: "Code update" })
  ).toBeVisible()
  await expect(
    matrix.getByRole("columnheader", { name: "Intake" })
  ).toBeVisible()
})
