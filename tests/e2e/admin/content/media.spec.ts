import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { gpsJpeg } from "../../../support/gps-jpeg"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Acceptance: a 15 MB JPEG with GPS EXIF uploads, and the stored file has
// no GPS tags.
test("upload strips GPS; in-use files can't be deleted", async ({ page }) => {
  test.setTimeout(120_000)
  const buffer = await gpsJpeg()
  const name = `e2e-${Date.now()}.jpg`
  await page.goto("/admin/media")
  await page
    .getByLabel("Upload files")
    .setInputFiles({ name, mimeType: "image/jpeg", buffer })
  const card = page.getByRole("button", {
    name: new RegExp(name.replace(".jpg", "")),
  })
  await expect(card).toBeVisible({ timeout: 60_000 })
  await card.click()
  const url = await page
    .getByRole("link", { name: "Open file" })
    .getAttribute("href")
  const stored = await page.request.get(url!)
  expect(stored.ok()).toBe(true)
  expect((await sharp(await stored.body()).metadata()).exif).toBeUndefined()

  await page
    .getByLabel("Alt text", { exact: true })
    .fill("A calm consulting room")
  await page.getByRole("button", { name: "Save details" }).click()
  await expect(page.getByText("Details saved")).toBeVisible()
  await page.keyboard.press("Escape")

  // The legal pages' hero uses hero-bg.png (seeded), so it is in use.
  await page.getByLabel("Search the library").fill("hero-bg")
  await page
    .getByRole("button", { name: /hero-bg/ })
    .first()
    .click()
  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Delete file" }).click()
  await expect(page.getByText("This file is still in use")).toBeVisible()
})
