import { expect, test } from "@playwright/test"

// Review Focus 4: unknown CMS paths 404 in proxy (Ruling R1); deeper unknown
// paths 404 because no route matches. Both render app/global-not-found.tsx.
for (const path of [
  "/about/extra",
  "/no/such/page",
  "/no-such-page",
  "/privacy",
  "/insights/nope",
  "/insights/__shell",
  "/__page",
]) {
  test(`${path} answers 404`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible()
    await expect(
      page.locator('meta[name="robots"][content*="noindex"]').first()
    ).toBeAttached()
    for (const name of ["Back to home", "Read the insights", "Get in touch"]) {
      await expect(page.getByRole("link", { name })).toBeVisible()
    }
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
