import { expect, test } from "@playwright/test"

import { api, createPublishedArticle } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Acceptance: the old URL 301s to the new one after a rename.
test("a renamed article's old URL answers 301", async ({ page, request }) => {
  const stamp = Date.now()
  const { id, version, draft } = await createPublishedArticle(request, {
    slug: `e2e-old-${stamp}`,
    title: `Rename ${stamp}`,
  })
  const saved = await api<{ version: number }>(
    request,
    "PATCH",
    `/articles/${id}/draft`,
    { version, draft: { ...draft, slug: `e2e-new-${stamp}` } }
  )
  await api(request, "POST", `/articles/${id}/publish`, {
    version: saved.version,
  })
  const old = await request.get(`/insights/e2e-old-${stamp}`, {
    maxRedirects: 0,
  })
  expect(old.status()).toBe(301)
  expect(new URL(old.headers().location!, "http://x").pathname).toBe(
    `/insights/e2e-new-${stamp}`
  )
  await page.goto(`/insights/e2e-old-${stamp}`)
  await expect(page).toHaveURL(new RegExp(`/insights/e2e-new-${stamp}$`))
  await expect(
    page.getByRole("heading", { name: `Rename ${stamp}`, level: 1 })
  ).toBeVisible()
})
