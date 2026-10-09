import { expect, test, type Locator, type Page } from "@playwright/test"

import { E2E_ORIGIN } from "../../fixtures/env"
import { E2E_USERS, signIn, signOut } from "../../support/admin"
import { STORAGE } from "../../support/storage"

const onDesktop = () => test.info().project.name === "desktop"

// The main navigation, opening the sheet first below 1024px.
async function mainNav(page: Page): Promise<Locator> {
  if (!onDesktop()) {
    await page.getByRole("button", { name: "Toggle navigation" }).click()
    const sheet = page.getByRole("dialog", { name: "Navigation" })
    await expect(sheet).toBeVisible()
    return sheet.getByRole("navigation", { name: "Main" })
  }
  return page.getByRole("navigation", { name: "Main" })
}

async function linkLabels(nav: Locator) {
  return (await nav.getByRole("link").allTextContents()).map((t) => t.trim())
}

test.describe("as intake", () => {
  test.use({ storageState: STORAGE.intake })

  test("sees only the dashboard and enquiries", async ({ page }) => {
    await page.goto("/admin")
    const nav = await mainNav(page)
    expect(await linkLabels(nav)).toEqual(["Dashboard", "Enquiries"])
    await expect(nav.getByText("Growth", { exact: true })).toHaveCount(0)
  })

  test("opens every link it is shown", async ({ page }) => {
    await page.goto("/admin")
    await (await mainNav(page)).getByRole("link", { name: "Enquiries" }).click()
    await expect(page).toHaveURL(/\/admin\/leads$/)
    await expect(
      page.getByRole("heading", { level: 1, name: "Enquiries" })
    ).toBeVisible()
  })

  test("is turned away from a section outside the role", async ({ page }) => {
    await page.goto("/admin/pages")
    await expect(page).toHaveURL(/\/admin\/no-access\?from=%2Fadmin%2Fpages$/)
    await expect(
      page.getByRole("heading", { name: "You don't have access to Pages" })
    ).toBeVisible()
  })
})

test.describe("as a viewer", () => {
  test.use({ storageState: STORAGE.viewer })

  // Content settings (globals) are the viewer's to read; the site frame
  // (settings: identity, notifications, privacy) is not.
  test("sees read-only content sections and content settings only", async ({
    page,
  }) => {
    await page.goto("/admin")
    expect(await linkLabels(await mainNav(page))).toEqual([
      "Dashboard",
      "Pages",
      "Insights",
      "Collections",
      "SEO",
      "Site settings",
    ])
    await page.goto("/admin/settings")
    await expect(
      page.getByRole("heading", { level: 1, name: "Site settings" })
    ).toBeVisible()
    await page.goto("/admin/settings/identity")
    await expect(
      page.getByRole("heading", { name: "You don't have access to Identity" })
    ).toBeVisible()
  })
})

test.describe("as an editor", () => {
  test.use({ storageState: STORAGE.editor })

  test("sees content sections, SEO and content settings", async ({ page }) => {
    await page.goto("/admin")
    expect(await linkLabels(await mainNav(page))).toEqual([
      "Dashboard",
      "Pages",
      "Insights",
      "Collections",
      "Media",
      "SEO",
      "Site settings",
    ])
  })

  test("the theme chosen in the user menu sticks", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/admin")
    await page.getByRole("button", { name: /^Account menu for / }).click()
    await page.getByRole("menuitemradio", { name: "Dark" }).click()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  })

  test("a collapsed sidebar stays collapsed after a reload", async ({
    page,
  }) => {
    test.skip(!onDesktop(), "desktop only: below 1024px it is a sheet")
    await page.goto("/admin")
    const sidebar = page.locator('[data-slot="sidebar"][data-state]')
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    await page.getByRole("button", { name: "Toggle navigation" }).click()
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await page.reload()
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
  })

  // Review Focus #4 and #5.
  test("below 1024px the navigation is a sheet a keyboard can leave", async ({
    page,
    context,
  }) => {
    test.skip(onDesktop(), "tablet and mobile only")
    // A preference saved on desktop must not shrink the sheet to icons.
    await context.addCookies([
      { name: "sidebar_state", value: "false", url: E2E_ORIGIN },
    ])
    await page.goto("/admin")
    const trigger = page.getByRole("button", { name: "Toggle navigation" })
    const sheet = page.getByRole("dialog", { name: "Navigation" })
    await expect(sheet).toBeHidden()

    await trigger.click()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole("link", { name: "Pages" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()

    await trigger.click()
    await sheet.getByRole("link", { name: "Pages" }).click()
    await expect(page).toHaveURL(/\/admin\/pages$/)
    await expect(sheet).toBeHidden()
  })
})

test.describe("as an owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("sees every section and a section's sub-pages", async ({ page }) => {
    await page.goto("/admin/seo")
    const nav = await mainNav(page)
    for (const label of [
      "Dashboard",
      "Enquiries",
      "Newsletter",
      "Marketing",
      "Appearance",
      "Site settings",
      "Users & roles",
      "Activity log",
    ]) {
      await expect(
        nav.getByRole("link", { name: label, exact: true })
      ).toBeVisible()
    }
    await expect(
      nav.getByRole("link", { name: "SEO", exact: true })
    ).toHaveAttribute("aria-current", "page")
    await expect(nav.getByRole("link", { name: "Redirects" })).toBeVisible()
  })
})

test.describe("signing out", () => {
  // A fresh session: the shared storage states must never be signed out.
  test.use({ storageState: { cookies: [], origins: [] } })

  test("from the user menu ends the session", async ({ page }) => {
    await page.goto("/admin/sign-in")
    await signIn(page, E2E_USERS.editor)
    await expect(page).toHaveURL(/\/admin$/)
    await signOut(page)
    await expect(page).toHaveURL(/\/admin\/sign-in/)
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/sign-in/)
  })
})
