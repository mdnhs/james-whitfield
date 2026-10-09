import { expect, test, type Page } from "@playwright/test"

const expectNotFoundPage = async (page: Page) => {
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible()
  // Site chrome on every viewport (the main nav collapses below desktop).
  await expect(page.locator("footer#contact")).toBeAttached()
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first()
  ).toBeAttached()
}

// Review Focus 4: a URL no route matches is a real 404. It renders
// app/global-not-found.tsx, which is prerendered and so carries no chrome.
for (const path of ["/no-such-page", "/about/extra"]) {
  test(`${path} answers 404`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible()
  })
}

// A route that exists but whose content is missing or unpublished streams its
// shell first under Cache Components, so the status stays 200; noindex keeps
// the soft 404 out of search results.
for (const path of ["/privacy", "/insights/nope", "/insights/__shell"]) {
  test(`${path} renders a noindex not-found page`, async ({ page }) => {
    await page.goto(path)
    await expectNotFoundPage(page)
  })
}

test("published CMS pages answer 200", async ({ request }) => {
  for (const path of [
    "/",
    "/about",
    "/services",
    "/how-it-works",
    "/insights",
    "/contact",
    "/insights/calm-is-a-skill",
  ]) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
})
