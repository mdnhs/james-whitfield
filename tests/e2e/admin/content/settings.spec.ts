import { expect, test, type Page } from "@playwright/test"

import { STORAGE } from "../../support/storage"

// Notifications are not public, so editing them cannot disturb parity.
test.use({ storageState: STORAGE.owner })

const recipients = (page: Page) =>
  page
    .getByLabel(/^Recipients \d+$/)
    .evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value))

test("save a setting twice, then roll back to the first save", async ({
  page,
}) => {
  await page.goto("/admin/settings/notifications")
  const [first, second] = [
    `a-${Date.now()}@example.com`,
    `b-${Date.now()}@example.com`,
  ]
  for (const email of [first, second]) {
    await page.getByRole("button", { name: "Add to recipients" }).click()
    await page
      .getByLabel(/^Recipients \d+$/)
      .last()
      .fill(email)
    await page.getByRole("button", { name: "Save notifications" }).click()
    await expect(page.getByText("Notifications saved").last()).toBeVisible()
  }
  expect(await recipients(page)).toEqual(
    expect.arrayContaining([first, second])
  )

  await page.getByRole("button", { name: "History" }).click()
  // Newest first: index 1 is the first save.
  await page.getByRole("button", { name: "Restore" }).nth(1).click()
  await expect(page.getByText("Restored")).toBeVisible()
  await expect.poll(() => recipients(page)).not.toContain(second)
  expect(await recipients(page)).toContain(first)
})
