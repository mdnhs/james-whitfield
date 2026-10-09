import { expect, test, type Page } from "@playwright/test"

import { STORAGE } from "../../support/storage"

// The provider marks <html> once the ⌘K listener is attached; a press before
// hydration would be lost.
async function openWithShortcut(page: Page) {
  await page.locator("html[data-palette-ready]").waitFor({ state: "attached" })
  await page.keyboard.press("ControlOrMeta+k")
  const palette = page.getByRole("dialog", { name: "Search the admin" })
  await expect(palette).toBeVisible()
  return palette
}

test.describe("as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("⌘K finds a page by keyword and goes there", async ({ page }) => {
    await page.goto("/admin")
    const palette = await openWithShortcut(page)
    await palette.getByRole("combobox").fill("invite")
    await palette.getByRole("option", { name: "Users & roles" }).click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(palette).toBeHidden()
  })

  test("the search pill opens it and Escape closes it", async ({ page }) => {
    await page.goto("/admin")
    const pill = page.getByRole("button", { name: "Search", exact: true })
    await pill.click()
    const palette = page.getByRole("dialog", { name: "Search the admin" })
    await expect(palette).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(palette).toBeHidden()
    await expect(pill).toBeFocused()
  })

  test("runs an action", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/admin")
    const palette = await openWithShortcut(page)
    await palette.getByRole("combobox").fill("dark")
    await palette.getByRole("option", { name: "Switch to dark theme" }).click()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  })
})

// Review Focus #3.
test.describe("as intake", () => {
  test.use({ storageState: STORAGE.intake })

  test("lists only what intake can open", async ({ page }) => {
    await page.goto("/admin")
    const palette = await openWithShortcut(page)
    const goTo = palette.getByRole("group", { name: "Go to" })
    await expect(goTo.getByRole("option")).toHaveText([
      "Dashboard",
      "Enquiries",
      "Help",
      "Account",
    ])
    await palette.getByRole("combobox").fill("users")
    await expect(
      palette.getByRole("option", { name: "Users & roles" })
    ).toHaveCount(0)
  })
})
