import { expect, test } from "@playwright/test"

import { createPublishedArticle, createPublishedPage } from "../../support/api"
import { STORAGE } from "../../support/storage"

// Regression: the client segment cache must never serve one record's editor
// for another record's URL (Next varyParams: the page has to read `params`
// before any dynamic access so the id is part of the cache key).
test.use({ storageState: STORAGE.editor })

test("a new article opens its own editor after another was visited", async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  await createPublishedArticle(request, {
    slug: `wr-a-${stamp}`,
    title: `Visited ${stamp}`,
  })
  // From the list, so its links are prefetched before the visit.
  await page.goto("/admin/insights")
  await page.waitForLoadState("networkidle")
  await page.getByRole("link", { name: `Visited ${stamp}` }).click()
  await expect(
    page.getByRole("heading", { name: `Visited ${stamp}`, level: 1 })
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Insights", exact: true })
    .first()
    .click()
  await page.getByRole("button", { name: "New article" }).click()
  // Scoped: the visited editor stays mounted (hidden) under <Activity>.
  const dialog = page.getByRole("dialog", { name: "New article" })
  await dialog.getByLabel("Title").fill(`Fresh ${stamp}`)
  await dialog.getByRole("combobox", { name: "Category" }).click()
  await page.getByRole("option").first().click()
  await dialog.getByRole("button", { name: "Create" }).click()
  await expect(
    page.getByRole("heading", { name: `Fresh ${stamp}`, level: 1 })
  ).toBeVisible()
  await expect(
    page.locator("input#article-title").filter({ visible: true })
  ).toHaveValue(`Fresh ${stamp}`)
})

test("command palette opens the article it names, not the one on screen", async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const a = await createPublishedArticle(request, {
    slug: `wr-pa-${stamp}`,
    title: `Alpha${stamp} visited`,
  })
  await createPublishedArticle(request, {
    slug: `wr-pb-${stamp}`,
    title: `Bravo${stamp} target`,
  })
  await page.goto(`/admin/insights/${a.id}`)
  await expect(
    page.getByRole("heading", { name: `Alpha${stamp} visited`, level: 1 })
  ).toBeVisible()
  await page.locator("html[data-palette-ready]").waitFor({ state: "attached" })
  await page.keyboard.press("ControlOrMeta+k")
  const palette = page.getByRole("dialog", { name: "Search the admin" })
  await palette.getByRole("combobox").fill(`Bravo${stamp}`)
  await palette.getByRole("option", { name: `Bravo${stamp} target` }).click()
  await expect(
    page.getByRole("heading", { name: `Bravo${stamp} target`, level: 1 })
  ).toBeVisible()
})

test("a new page opens its own builder after another was visited", async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const a = await createPublishedPage(request, "Visited page")
  await page.goto(`/admin/pages/${a.id}`)
  await expect(
    page.getByRole("heading", { name: "E2E page", level: 1 })
  ).toBeVisible()
  await page.getByRole("link", { name: "Pages", exact: true }).first().click()
  await page.getByRole("button", { name: "New page" }).click()
  const dialog = page.getByRole("dialog", { name: "New page" })
  await dialog.getByLabel("Path").fill(`/e2e-wr-${stamp}`)
  await dialog.getByLabel("Title").fill(`Fresh page ${stamp}`)
  await dialog.getByRole("button", { name: "Create page" }).click()
  await expect(
    page.getByRole("heading", { name: `Fresh page ${stamp}`, level: 1 })
  ).toBeVisible()
})
