import { expect, test } from "@playwright/test"

import { latestEmail } from "../../support/mailpit"
import { testIp } from "../../support/public"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.owner })

test("subscribe, confirm, see it in the admin list, then unsubscribe", async ({
  page,
  browser,
  baseURL,
}) => {
  const id = `${Date.now()}${Math.floor(Math.random() * 1e4)}`
  const email = `news+${id}@example.com`
  const since = new Date()
  const visitor = await browser.newContext({
    baseURL,
    reducedMotion: "reduce",
    extraHTTPHeaders: { "x-real-ip": testIp() },
  })
  const site = await visitor.newPage()
  await site.goto("/insights")
  const band = site.locator('form:has(input[name="email"])')
  await expect(band).toHaveCount(1)
  await band.locator('input[name="email"]').fill(email)
  await band.locator('button[type="submit"]').click()
  await expect(band).toHaveCount(0)

  const mail = await latestEmail(`to:"${email}"`, since)
  const confirmLink = mail.Text.match(
    /https?:\/\/\S+\/api\/v1\/public\/newsletter\/confirm\?token=\S+/
  )![0]
  const unsubscribeLink = mail.Text.match(
    /https?:\/\/\S+\/newsletter\/unsubscribe\?token=\S+/
  )![0]

  await visitor.newPage().then((p) => p.goto(confirmLink))
  const confirmed = visitor.pages().at(-1)!
  await expect(confirmed).toHaveURL(/\/newsletter\/confirmed$/)
  await expect(confirmed.getByRole("heading", { level: 1 })).toBeVisible()

  await page.goto("/admin/newsletter")
  await page.getByRole("searchbox", { name: "Search subscribers" }).fill(email)
  await expect(page.getByRole("row", { name: email })).toContainText(
    "Confirmed"
  )

  await confirmed.goto(unsubscribeLink)
  await confirmed.locator('form button[type="submit"]').click()
  await expect(confirmed).toHaveURL(/\/newsletter\/unsubscribed$/)
  await visitor.close()
})
