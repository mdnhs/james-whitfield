import { expect, test } from "@playwright/test"

import {
  api,
  createPublishedPage,
  withHeroSubtitle,
  type PageDocument,
} from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Review Focus 4.
test("drafts show in preview only, never to the public", async ({
  page,
  browser,
}) => {
  const { id, path } = await createPublishedPage(
    page.request,
    "Published words"
  )
  const { version, draft } = await api<{
    version: number
    draft: PageDocument
  }>(page.request, "GET", `/pages/${id}`)
  await api(page.request, "PATCH", `/pages/${id}/draft`, {
    version,
    document: withHeroSubtitle(draft, "Draft words"),
  })

  const anonymous = await (await browser.newContext()).newPage()
  await anonymous.goto(path)
  await expect(anonymous.getByText("Published words")).toBeVisible()
  await expect(anonymous.getByText("Draft words")).toHaveCount(0)

  await page.goto(`/api/v1/admin/preview?path=${encodeURIComponent(path)}`)
  await expect(page).toHaveURL(path)
  await expect(page.getByText("Draft words")).toBeVisible()
  await expect(page.getByText("Previewing unpublished changes")).toBeVisible()

  await page.getByRole("link", { name: "Exit preview" }).click()
  await expect(page.getByText("Published words")).toBeVisible()

  await anonymous.reload()
  await expect(anonymous.getByText("Draft words")).toHaveCount(0)
})
