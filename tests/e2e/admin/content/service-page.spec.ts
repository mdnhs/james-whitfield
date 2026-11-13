import { expect, test } from "@playwright/test"

import { api, createService } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

type Band = { values: { title: string; isVisible: boolean } }

// Acceptance: an editor turns a service's details page on from Website →
// Services, rewrites the template's hero and publishes. The page keeps the
// template's seven sections; the editor changes their content only.
test("turn on a service's details page, edit its hero, publish", async ({
  page,
  browser,
}) => {
  const service = await createService(page.request)
  const { items: bands } = await api<{ items: Band[] }>(
    page.request,
    "GET",
    "/collections/cta-bands"
  )
  const band = bands.find((b) => b.values.isVisible)!

  // The page was made with the service. Services → Edit opens one editor
  // with the service's card, its details page and SEO.
  await page.goto("/admin/website/services")
  await page.getByRole("button", { name: `Edit ${service.title}` }).click()
  await expect(page).toHaveURL(
    new RegExp(`/admin/website/services/${service.id}$`)
  )
  for (const tab of ["Card", "Details", "SEO"])
    await expect(page.getByRole("tab", { name: tab })).toBeVisible()
  // Live at once, with placeholder copy to rewrite.
  await expect(
    page.getByText("Published", { exact: true }).first()
  ).toBeVisible()
  await page.getByRole("tab", { name: "Details" }).click()

  // Seven fixed sections and nothing that adds, removes, hides or moves one.
  // :visible — Next keeps the previous route's builder in the DOM, hidden.
  await expect(page.locator("[data-block-card]:visible")).toHaveCount(7)
  await expect(page.getByRole("button", { name: "Add block" })).toHaveCount(0)
  for (const label of await page
    .locator("[data-block-card]:visible h2")
    .allTextContents()) {
    for (const verb of ["Remove", "Hide", "Show", "Reorder"])
      await expect(
        page.getByRole("button", { name: `${verb} ${label}`, exact: true })
      ).toHaveCount(0)
  }

  const title = `Calmer ${Date.now()}`
  await page
    .getByRole("group", { name: "Page hero" })
    .getByLabel("Title", { exact: true })
    .fill(title)
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  const published = page.waitForResponse(
    (r) => /\/pages\/[^/]+\/publish$/.test(r.url()) && r.ok()
  )
  await page.getByRole("button", { name: "Publish" }).click()
  await published

  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(`/services/${service.slug}`)
  const main = visitor.getByRole("main")
  await expect(
    main.getByRole("heading", { name: title, level: 1 })
  ).toBeVisible()
  for (const heading of [
    `What ${service.title} is`,
    `What ${service.title} can change`,
    "From first call to lasting change",
    "Choose the format that suits you",
    "Frequently asked questions",
    band.values.title,
  ]) {
    await expect(
      main.getByRole("heading", { name: heading, exact: true }),
      heading
    ).toBeVisible()
  }
  await expect(
    main.getByRole("link", { name: "Book a discovery call" }).first()
  ).toHaveAttribute("href", "/contact")
})
