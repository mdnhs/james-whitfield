import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"
import { recordViolations, violations } from "../support/csp"
import { settle } from "../support/settle"

test.beforeEach(({ page }) => recordViolations(page))

for (const route of PARITY_ROUTES) {
  test(`csp: no violations on ${route.path}`, async ({ page }) => {
    await page.goto(route.path)
    await settle(page)
    expect(await violations(page)).toEqual([])
  })
}

test("csp: no violations through a client-side navigation", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("link", { name: "About" }).first().click()
  await page.waitForURL("**/about")
  await settle(page)
  expect(await violations(page)).toEqual([])
})

test("csp: media images render under the enforced policy", async ({ page }) => {
  await page.goto("/")
  await settle(page)
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((i) => i.currentSrc && !(i.complete && i.naturalWidth > 0))
      .map((i) => i.currentSrc)
  )
  expect(await page.locator("img").count()).toBeGreaterThan(0)
  expect(broken).toEqual([])
  expect(await violations(page)).toEqual([])
})

test("csp: an injected inline snippet runs (script-src 'unsafe-inline')", async ({
  page,
}) => {
  await page.goto("/")
  await settle(page)
  const ran = await page.evaluate(() => {
    const s = document.createElement("script")
    s.textContent = "window.__snippet = 42"
    document.head.append(s)
    return (window as unknown as { __snippet?: number }).__snippet
  })
  expect(ran).toBe(42)
  expect(await violations(page)).toEqual([])
})
