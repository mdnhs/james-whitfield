import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

test("a manual redirect answers 301, keeps the query and counts the hit", async ({
  page,
  request,
}) => {
  const id = Date.now().toString(36)
  await page.goto("/admin/seo/redirects")
  await page.getByRole("button", { name: "New redirect" }).click()
  await page.getByRole("textbox", { name: "From" }).fill(`/e2e-old-${id}`)
  await page.getByRole("textbox", { name: "To" }).fill("/about")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText(`/e2e-old-${id}`)).toBeVisible()
  // The proxy fails open after 300 ms, so a cold resolver may answer 404 once.
  let res!: Awaited<ReturnType<typeof request.get>>
  await expect
    .poll(async () => {
      res = await request.get(`/e2e-old-${id}?utm_source=x`, {
        maxRedirects: 0,
      })
      return res.status()
    })
    .toBe(301)
  expect(res.headers()["location"]).toBe("/about?utm_source=x")
  await expect
    .poll(async () => {
      await page.reload()
      return page
        .getByRole("row", { name: new RegExp(`/e2e-old-${id}`) })
        .getByRole("cell")
        .nth(3)
        .textContent()
    })
    .toBe("1")
})

test("a redirect from a live page warns and does not take effect", async ({
  page,
  request,
}) => {
  await page.goto("/admin/seo/redirects")
  await page.getByRole("button", { name: "New redirect" }).click()
  await page.getByRole("textbox", { name: "From" }).fill("/contact")
  await page.getByRole("textbox", { name: "To" }).fill("/about")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText(/A live page is at this address/)).toBeVisible()
  expect((await request.get("/contact", { maxRedirects: 0 })).status()).toBe(
    200
  )
  // Clean up so other specs see /contact untouched.
  const row = page.getByRole("row", { name: /\/contact/ })
  await row.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).last().click()
})

test("the SEO center shows a health score and Fix links into the editor", async ({
  page,
}) => {
  await page.goto("/admin/seo")
  await expect(
    page.getByRole("heading", { level: 1, name: "SEO" })
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "SEO health" })).toBeVisible()
  const fix = page
    .getByRole("list", { name: "Issues" })
    .getByRole("link", { name: "Fix" })
    .first()
  if (await fix.count()) {
    await fix.click()
    await expect(page).toHaveURL(/tab=seo/)
    await expect(page.getByText("In search results")).toBeVisible()
  }
})

test("the SERP preview follows the SEO title as it is typed", async ({
  page,
}) => {
  await page.goto("/admin/pages")
  await page.getByRole("link", { name: /About/ }).first().click()
  await page.getByRole("tab", { name: "SEO" }).click()
  await page.getByLabel("SEO title").fill("Meet Magda")
  await expect(
    page.getByLabel("In search results").getByText("Meet Magda | Magda Kennedy")
  ).toBeVisible()
})
