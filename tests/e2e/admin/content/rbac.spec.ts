import { expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../../fixtures/env"
import { createPublishedPage } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.author })

// Acceptance: an author gets 403 on publish, and the builder opens view-only
// (page.read) instead of as an editor whose saves would all fail.
test("an author cannot publish", async ({ page, browser }) => {
  const editor = await browser.newContext({ storageState: STORAGE.editor })
  const { id, version } = await createPublishedPage(editor.request, "Words")
  const response = await page.request.post(
    `/api/v1/admin/pages/${id}/publish`,
    { data: { version }, headers: { origin: E2E_ORIGIN } }
  )
  expect(response.status()).toBe(403)
  expect((await response.json()).error.code).toBe("FORBIDDEN")
  await page.goto(`/admin/pages/${id}`)
  await expect(page.getByRole("heading", { name: "E2E page" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
  await expect(page.getByRole("note")).toContainText("View only")
  await expect(page.getByRole("button", { name: "Add block" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Text" })).toHaveAttribute(
    "contenteditable",
    "false"
  )
})
