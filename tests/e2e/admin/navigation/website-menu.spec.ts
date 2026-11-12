import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })

// The old Pages, Collections and settings Navigation/Footer URLs still work:
// each lands on the Website screen that replaced it.
const MOVED = [
  ["/admin/pages", /\/admin\/website\/home$/],
  ["/admin/collections/faqs", /\/admin\/website\/home$/],
  ["/admin/settings/footer", /\/admin\/website\/header-footer$/],
] as const

for (const [from, to] of MOVED) {
  test(`${from} redirects to its Website screen`, async ({ page }) => {
    await page.goto(from)
    await expect(page).toHaveURL(to)
  })
}

test("the sidebar offers Website, not Pages or Collections", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "admin-desktop",
    "the sidebar is a sheet below 1024px"
  )
  await page.goto("/admin/website/home")
  const nav = page.getByRole("navigation", { name: "Main" })
  await expect(nav.getByRole("link", { name: "Website" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Pages" })).toHaveCount(0)
  await expect(nav.getByRole("link", { name: "Collections" })).toHaveCount(0)
})
