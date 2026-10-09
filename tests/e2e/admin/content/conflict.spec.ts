import { expect, test, type Page } from "@playwright/test"

import { createPublishedPage } from "../../support/api"
import { STORAGE } from "../../support/storage"

async function type(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: "Text" })
  await box.click()
  await page.keyboard.press("End")
  await page.keyboard.type(text)
}

// Acceptance: concurrent edits produce the 409 dialog.
test("a second tab gets the conflict dialog", async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE.editor })
  const [a, b] = [await context.newPage(), await context.newPage()]
  const { id } = await createPublishedPage(a.request, "Shared words")
  for (const tab of [a, b]) await tab.goto(`/admin/pages/${id}`)

  await type(a, " from A")
  await expect(a.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  await type(b, " from B")
  const dialog = b.getByRole("dialog", { name: "Changed by someone else" })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole("button", { name: "Review changes" }).click()
  await expect(b.getByText("Shared words from A")).toBeVisible()
})
