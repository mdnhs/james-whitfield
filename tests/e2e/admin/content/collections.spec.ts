import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// A hidden row never reaches the public site, so parity is untouched.
test("add a hidden FAQ, see where FAQs are used, delete it", async ({
  page,
}) => {
  const question = `E2E question ${Date.now()}?`
  await page.goto("/admin/collections/faqs")
  await page.getByRole("button", { name: "Add FAQ" }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByLabel("Question").fill(question)
  await sheet.getByLabel("Answer").fill("An answer written by the E2E suite.")
  await sheet.getByRole("switch", { name: "Visible on the site" }).click()
  await sheet.getByRole("button", { name: "Save" }).click()
  const row = page.getByRole("row", {
    name: new RegExp(question.replace("?", "\\?")),
  })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Hidden")
  // FAQ blocks in "all" mode show every row, so the hint names their pages.
  await expect(row).not.toContainText("Not used")

  await row.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("button", { name: "Delete for good" }).click()
  await expect(row).toHaveCount(0)
})
