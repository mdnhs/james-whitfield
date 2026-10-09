import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { STORAGE } from "../../support/storage"

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

// Acceptance: axe reports no serious or critical violations.
async function blocking(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes.map((node) => node.target.join(" ")).join(", ")}`
    )
}

const PANEL = [
  "/admin",
  "/admin/design",
  "/admin/activity",
  "/admin/account",
  "/admin/account?tab=security",
  "/admin/account?tab=sessions",
  "/admin/pages",
  "/admin/no-access?from=%2Fadmin%2Fpages",
]

test.describe("signed in as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  for (const colorScheme of ["light", "dark"] as const) {
    for (const path of PANEL) {
      test(`${path} in ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme })
        await page.goto(path)
        expect(await blocking(page)).toEqual([])
      })
    }
  }

  test("with the ⌘K palette open", async ({ page }) => {
    await page.goto("/admin")
    // A press before the ⌘K listener is attached would be lost.
    await page
      .locator("html[data-palette-ready]")
      .waitFor({ state: "attached" })
    await page.keyboard.press("ControlOrMeta+k")
    await expect(
      page.getByRole("dialog", { name: "Search the admin" })
    ).toBeVisible()
    expect(await blocking(page)).toEqual([])
  })

  test("with the user menu open", async ({ page }) => {
    await page.goto("/admin")
    await page.getByRole("button", { name: /^Account menu for / }).click()
    await expect(page.getByRole("menu")).toBeVisible()
    expect(await blocking(page)).toEqual([])
  })
})

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const path of ["/admin/sign-in", "/admin/forgot-password"]) {
    test(path, async ({ page }) => {
      await page.goto(path)
      expect(await blocking(page)).toEqual([])
    })
  }
})
