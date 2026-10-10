import { expect, test } from "@playwright/test"

import { E2E_ENV, E2E_ORIGIN } from "../../fixtures/env"
import { api, createPublishedArticle } from "../../support/api"
import { runSql } from "../../support/db"
import { STORAGE } from "../../support/storage"

test.describe("as an editor", () => {
  test.use({ storageState: STORAGE.editor })

  test("writes and publishes an article from the editor", async ({ page }) => {
    const stamp = Date.now()
    await page.goto("/admin/insights")
    await page.getByRole("button", { name: "New article" }).click()
    await page.getByLabel("Title").fill(`Written ${stamp}`)
    await page.getByRole("combobox", { name: "Category" }).click()
    await page.getByRole("option").first().click()
    await page.getByRole("button", { name: "Create" }).click()
    await expect(
      page.getByRole("heading", { name: `Written ${stamp}` })
    ).toBeVisible()
    const body = page.getByRole("textbox", { name: "Article body" })
    await body.click()
    await page.keyboard.type("A calm opening paragraph for the test.")
    await page.keyboard.press("Shift+Home")
    await page
      .getByRole("toolbar", { name: "Text formatting" })
      .getByRole("button", { name: "Bold" })
      .click()
    // The menu button hands focus back on the next frame; keys sent before
    // that never reach the editor.
    await expect(body).toBeFocused()
    // ArrowRight collapses the selection to its end on every OS (End only
    // scrolls on macOS).
    await page.keyboard.press("ArrowRight")
    // ProseMirror reads the new caret on a later frame; an Enter sent first
    // would still act on the old selection and replace the text.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve))
    )
    await page.keyboard.press("Enter")
    // exact: the side panel's "Choose cover image" also contains "image".
    await page.getByRole("button", { name: "Image", exact: true }).click()
    await page
      .getByRole("dialog", { name: "Choose an image" })
      .getByRole("button")
      .first()
      .click()
    await expect(page.getByText(/\d+ min read/)).toBeVisible()
    await page.getByLabel("Slug").fill(`written-${stamp}`)
    await page.getByLabel("Excerpt").fill("An excerpt written in the E2E test.")
    await page.getByRole("button", { name: "Choose cover image" }).click()
    await page
      .getByRole("dialog", { name: "Choose an image" })
      .getByRole("button")
      .first()
      .click()
    await expect(page.getByText("Saved")).toBeVisible()
    await page.getByRole("button", { name: "Publish" }).click()
    await expect(
      page.getByText("Published", { exact: true }).first()
    ).toBeVisible()
    await page.goto(`/insights/written-${stamp}`)
    await expect(
      page.getByRole("heading", { name: `Written ${stamp}`, level: 1 })
    ).toBeVisible()
    await expect(
      page
        .locator("article strong, main strong")
        .filter({ hasText: "A calm opening" })
    ).toBeVisible()
  })

  // Acceptance (with tests/integration/api/cron.test.ts): a scheduled article
  // appears after the tick. The interval is off in E2E (Ruling R10), so the
  // spec moves the schedule into the past and calls the tick itself.
  test("a scheduled article goes live on the tick", async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const { id, version } = await createPublishedArticle(request, {
      slug: `sched-${stamp}`,
      title: `Scheduled ${stamp}`,
    })
    await api(request, "POST", `/articles/${id}/unpublish`, { version })
    await page.goto(`/admin/insights/${id}`)
    await page.getByRole("button", { name: "Schedule" }).click()
    const dialog = page.getByRole("dialog", { name: "Schedule publishing" })
    await dialog.getByLabel("Publish at (Dublin time)").fill("2099-01-01T09:00")
    await dialog.getByRole("button", { name: "Schedule" }).click()
    await expect(
      page.getByText("Scheduled", { exact: true }).first()
    ).toBeVisible()
    expect((await request.get(`/insights/sched-${stamp}`)).status()).toBe(200) // soft 404 until live
    await expect(async () => {
      await runSql(
        "update articles set scheduled_for = now() - interval '1 minute' where id = $1",
        [id]
      )
      const tick = await request.post("/api/v1/cron/tick", {
        headers: { authorization: `Bearer ${E2E_ENV.CRON_SECRET}` },
      })
      expect((await tick.json()).published).toContain(id)
    }).toPass()
    await page.goto(`/insights/sched-${stamp}`)
    await expect(
      page.getByRole("heading", { name: `Scheduled ${stamp}`, level: 1 })
    ).toBeVisible()
  })
})

test.describe("as an author", () => {
  test.use({ storageState: STORAGE.author })

  // Acceptance: an author cannot publish.
  test("can submit for review but not publish", async ({ page, browser }) => {
    const editor = await browser.newContext({ storageState: STORAGE.editor })
    const { id, version } = await createPublishedArticle(editor.request, {
      slug: `auth-${Date.now()}`,
      title: "Not yours",
    })
    const response = await page.request.post(
      `/api/v1/admin/articles/${id}/publish`,
      { data: { version }, headers: { origin: E2E_ORIGIN } }
    )
    expect(response.status()).toBe(403)
    await page.goto("/admin/insights")
    await page.getByRole("button", { name: "New article" }).click()
    await page.getByLabel("Title").fill(`Mine ${Date.now()}`)
    await page.getByRole("combobox", { name: "Category" }).click()
    await page.getByRole("option").first().click()
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Schedule" })).toHaveCount(0)
    await page.getByRole("button", { name: "Submit for review" }).click()
    // Visible only: the hidden list route (<Activity>) keeps its own pills.
    await expect(
      page.getByText("Review requested").filter({ visible: true })
    ).toBeVisible()
    await page.goto(`/admin/insights/${id}`)
    await expect(page.getByRole("note")).toContainText("View only")
    await editor.close()
  })
})
