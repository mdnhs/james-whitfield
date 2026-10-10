import { expect, test } from "@playwright/test"

import { createPublishedPage } from "../../support/api"
import { recordViolations, violations } from "../../support/csp"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })
test.beforeEach(({ page }) => recordViolations(page))

const SCREENS = [
  "/admin",
  "/admin/pages",
  "/admin/insights",
  "/admin/media",
  "/admin/leads",
  "/admin/seo",
  "/admin/marketing",
  "/admin/appearance",
  "/admin/account",
  "/admin/users",
  "/admin/users?tab=roles",
  "/admin/activity",
]

for (const path of SCREENS) {
  test(`csp: no violations on ${path}`, async ({ page }) => {
    await page.goto(path)
    await page
      .waitForLoadState("networkidle", { timeout: 5_000 })
      .catch(() => {})
    expect(await violations(page)).toEqual([])
  })
}

test("csp: the page-builder preview iframe loads (frame-src / frame-ancestors self)", async ({
  page,
}) => {
  const { id } = await createPublishedPage(page.request, "CSP preview")
  await page.goto(`/admin/pages/${id}`)
  const frame = page.frameLocator('iframe[title="Page preview"]')
  await expect(frame.locator("body")).toContainText("CSP preview", {
    timeout: 15_000,
  })
  expect(await violations(page)).toEqual([])
})
