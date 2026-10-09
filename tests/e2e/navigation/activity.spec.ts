import { expect, test } from "@playwright/test"

// Cache Components keeps the previous route in the DOM, hidden. The rail and
// hash links must reach the page the reader is on, not the hidden copy.
test.use({ viewport: { width: 1440, height: 900 } })

const mainNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Main" })

const openRail = async (page: import("@playwright/test").Page) => {
  // The rail joins once the reader has left the hero.
  await page.mouse.wheel(0, 1400)
  const rail = page.getByRole("navigation", { name: "Page sections" })
  await expect(rail).toBeVisible()
  return rail
}

test("rail targets the visible page after navigating between pages that share #faq", async ({
  page,
}) => {
  await page.goto("/")
  await mainNav(page).getByRole("link", { name: "Contact" }).click()
  await expect(page).toHaveURL(/\/contact$/)
  const rail = await openRail(page)
  await rail.getByRole("button", { name: "FAQ" }).click()
  await expect(page.locator("#faq:visible")).toBeInViewport()
})

test("rail reaches the footer-level #contact after navigating", async ({
  page,
}) => {
  await page.goto("/about")
  await mainNav(page).getByRole("link", { name: "Services" }).click()
  await expect(page).toHaveURL(/\/services$/)
  const rail = await openRail(page)
  await rail.getByRole("button", { name: "Contact" }).click()
  await expect(page.locator("footer#contact")).toBeInViewport()
})

test("a preserved route still reveals its hero after going back", async ({
  page,
}) => {
  await page.goto("/")
  await mainNav(page).getByRole("link", { name: "About" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "About" })
  ).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
})
