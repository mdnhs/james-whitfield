import { expect, test } from "@playwright/test"

import { runSql } from "../support/db"
import {
  consentCookie,
  dataLayer,
  enableTracking,
  stubVendors,
} from "../support/tracking"

test.describe.configure({ mode: "serial" })
test.beforeAll(enableTracking)

const banner = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "E2E cookie banner" })

test("no request to googletagmanager.com or connect.facebook.net before consent", async ({
  context,
  page,
}) => {
  const hits = await stubVendors(context)
  await page.goto("/")
  await expect(banner(page)).toBeVisible()
  // The bootstrap ran: consent defaults are the first dataLayer entry.
  expect(await dataLayer(page)).toContain('"default"')
  await page.goto("/about")
  await page.waitForTimeout(1000)
  expect(hits).toEqual([])
  const names = (await context.cookies()).map((c) => c.name)
  expect(names.filter((n) => /^_ga|^_gcl_|^_fb/.test(n))).toEqual([])
})

test("Accept loads GTM and the Pixel, and is logged", async ({
  context,
  page,
}) => {
  const hits = await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Accept all" }).click()
  await expect
    .poll(() => hits.some((u) => u.includes("gtm.js?id=GTM-E2ETEST")))
    .toBe(true)
  await expect
    .poll(() => hits.some((u) => u.includes("fbevents.js")))
    .toBe(true)
  const cookie = await consentCookie(context)
  expect(cookie).toMatchObject({ v: 1, a: 1, m: 1 })
  await expect
    .poll(async () =>
      (
        await runSql(
          "select action from consent_events where consent_id = $1",
          [cookie.id]
        )
      ).map((r) => r.action)
    )
    .toEqual(["accept"])
  // A returning visitor: GTM loads at parse time, no banner.
  hits.length = 0
  await page.reload()
  await expect(banner(page)).toBeHidden()
  await expect.poll(() => hits.some((u) => u.includes("gtm.js"))).toBe(true)
})

test("Reject loads nothing", async ({ context, page }) => {
  const hits = await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Reject all" }).click()
  await page.reload()
  await expect(banner(page)).toBeHidden()
  await page.goto("/services")
  await page.waitForTimeout(1000)
  expect(hits).toEqual([])
  expect(await consentCookie(context)).toMatchObject({ a: 0, m: 0 })
})

test("withdrawal deletes the tracking cookies", async ({ context, page }) => {
  await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Accept all" }).click()
  await context.addCookies(
    ["_ga", "_ga_E2ETEST", "_gcl_au", "_fbp", "_fbc"].map((name) => ({
      name,
      value: "1",
      domain: "localhost",
      path: "/",
    }))
  )
  await page.getByRole("button", { name: "Cookie settings" }).click()
  await banner(page)
    .getByRole("checkbox", { name: /Analytics/ })
    .uncheck()
  await banner(page)
    .getByRole("checkbox", { name: /Marketing/ })
    .uncheck()
  await Promise.all([
    page.waitForEvent("load"),
    banner(page).getByRole("button", { name: "Save choices" }).click(),
  ])
  const names = (await context.cookies()).map((c) => c.name)
  expect(names.filter((n) => /^_ga|^_gcl_|^_fb/.test(n))).toEqual([])
  const cookie = await consentCookie(context)
  expect(cookie).toMatchObject({ a: 0, m: 0 })
  const actions = (
    await runSql(
      "select action from consent_events where consent_id = $1 order by created_at",
      [cookie.id]
    )
  ).map((r) => r.action)
  expect(actions).toEqual(["accept", "withdraw"])
})

test("newsletter tokens and contact topics never reach the dataLayer or Meta", async ({
  context,
  page,
}) => {
  await stubVendors(context)
  await page.goto("/")
  await banner(page).getByRole("button", { name: "Accept all" }).click()
  const metaTracks = () =>
    page.evaluate(
      () =>
        (
          (window as never as { fbq?: { queue: unknown[][] } }).fbq?.queue ?? []
        ).filter((call) => call[0] === "track").length
    )
  await page.goto("/newsletter/unsubscribe?token=e2e.secret")
  const nl = await dataLayer(page)
  expect(nl).not.toContain("e2e.secret")
  expect(nl).not.toContain("token")
  expect(await metaTracks()).toBe(0)
  await page.goto("/contact?topic=anxiety-stress")
  const contact = await dataLayer(page)
  expect(contact).not.toContain("anxiety")
  expect(contact).toContain('"location":"http://localhost:3100/contact"')
  expect(await metaTracks()).toBe(0)
})

test("the Tracking page shows GTM ready", async ({ browser }) => {
  const { STORAGE } = await import("../support/storage")
  const ctx = await browser.newContext({ storageState: STORAGE.owner })
  const page = await ctx.newPage()
  await page.goto("/admin/marketing")
  const status = page.getByRole("region", { name: "Status" })
  await expect(status.getByText("Google Tag Manager")).toBeVisible()
  await expect(status.getByText("Ready").first()).toBeVisible()
  await ctx.close()
})
