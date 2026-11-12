import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Shared items are edited inside the page section that shows them. A hidden
// row never reaches the public site, so parity is untouched.
test("add a hidden FAQ from the Home page's FAQ section, then remove it", async ({
  page,
}) => {
  const question = `E2E question ${Date.now()}?`
  await page.goto("/admin/website/home")
  await page
    .getByRole("list", { name: "Blocks" })
    .getByRole("button", { name: /^FAQ\s*#faq/ })
    .click()
  const panel = page.getByRole("region", { name: "FAQs" })
  await panel.getByRole("button", { name: "Add FAQ" }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByLabel("Question").fill(question)
  await sheet.getByLabel("Answer").fill("An answer written by the E2E suite.")
  await sheet.getByRole("switch", { name: "Visible on the site" }).click()
  await sheet.getByRole("button", { name: "Save" }).click()
  const row = panel.getByRole("listitem").filter({ hasText: question })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Hidden")
  await expect(
    row.getByRole("switch", { name: `Show ${question}` })
  ).not.toBeChecked()

  // Removing a shared item asks first: it goes from every page.
  await row.getByRole("button", { name: `Remove ${question}` }).click()
  const confirm = page.getByRole("dialog", { name: `Remove ${question}?` })
  await expect(confirm).toContainText("This removes it everywhere.")
  await confirm.getByRole("button", { name: "Remove" }).click()
  await expect(row).toHaveCount(0)
})
