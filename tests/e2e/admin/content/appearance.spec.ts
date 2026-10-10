import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })
// One theme row: the tests edit the same draft.
test.describe.configure({ mode: "serial" })

test("a preset saves as a draft and Discard draft takes it back", async ({
  page,
}) => {
  await page.goto("/admin/appearance")
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible()
  await page.getByRole("button", { name: /Ocean/ }).first().click()
  await expect(page.getByText("Draft saved")).toBeVisible()
  const discard = page.getByRole("button", { name: "Discard draft" })
  await expect(discard).toBeEnabled()
  await discard.click()
  await expect(discard).toBeDisabled()
})

test("a failing pair blocks Publish until Fix all repairs it", async ({
  page,
}) => {
  await page.goto("/admin/appearance")
  await page.getByText("Advanced tokens").click()
  const muted = page.getByLabel("Muted text", { exact: true })
  await muted.fill("#dddddd")
  await muted.blur()
  await expect(
    page.getByText("Publishing is blocked until every pair passes.")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled()
  await page.getByRole("button", { name: "Fix all" }).click()
  await expect(
    page.getByText("Publishing is blocked until every pair passes.")
  ).toBeHidden()
  await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled()
  await expect(page.getByRole("status").first()).toHaveText("Draft saved")
  await page.getByRole("button", { name: "Discard draft" }).click()
  await expect(
    page.getByRole("button", { name: "Discard draft" })
  ).toBeDisabled()
})
