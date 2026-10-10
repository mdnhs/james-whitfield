import { expect, test } from "@playwright/test"

import { api } from "../../support/api"
import { latestEmail } from "../../support/mailpit"
import { postLead, publicStamp, testIp } from "../../support/public"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.intake })

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e4)}`

test("a form submission reaches the inbox and the notification has no message", async ({
  page,
  browser,
  baseURL,
}) => {
  const id = unique()
  const name = `Enquirer ${id}`
  const message = `Private message ${id}`
  const since = new Date()
  // A visitor with its own client IP.
  const visitor = await browser.newContext({
    baseURL,
    reducedMotion: "reduce",
    extraHTTPHeaders: { "x-real-ip": testIp() },
  })
  const site = await visitor.newPage()
  await site.goto("/contact")
  // The form prerenders blank in a Suspense fallback, then remounts with the
  // URL state: type only once the fallback is gone.
  await expect(site.locator('[name="name"]')).toHaveCount(1)
  await site.locator('[name="name"]').fill(name)
  await site.locator('[name="email"]').fill(`e2e+${id}@example.com`)
  await site.locator('[name="topic"]').selectOption({ index: 1 })
  await site.locator('[name="message"]').fill(message)
  await site.locator('[name="consent"]').check()
  await site.waitForTimeout(3_200) // the 3 s fill-time floor
  await site.locator('form button[type="submit"]').click()
  await expect(site.getByRole("status")).toBeVisible()
  await visitor.close()

  const mail = await latestEmail(`subject:"New enquiry from ${name}"`, since)
  expect(mail.Text).not.toContain(message)
  expect(mail.HTML).not.toContain(message)
  expect(mail.Text).toMatch(/\/admin\/leads\?lead=[0-9a-f-]{36}/)

  await page.goto("/admin/leads?view=table")
  await expect(
    page.getByRole("heading", { level: 1, name: "Enquiries" })
  ).toBeVisible()
  await page.getByRole("searchbox", { name: "Search enquiries" }).fill(name)
  await page.getByRole("row", { name: new RegExp(name) }).click()
  await expect(page.getByRole("dialog", { name })).toBeVisible()
  await expect(page.getByText(message)).toBeVisible()
})

test("a honeypot submission returns success but is stored as spam", async ({
  request,
}) => {
  const id = unique()
  const stamp = await publicStamp(request)
  await new Promise((r) => setTimeout(r, 3_200))
  const res = await postLead(
    request,
    {
      name: `Bot ${id}`,
      email: `bot+${id}@example.com`,
      topic: "something-else",
      consent: true,
      website: "https://spam.example",
      stamp,
    },
    testIp()
  )
  expect(res.status()).toBe(201)
  expect(await res.json()).toEqual({ ok: true })
  const spam = await api<{ items: { name: string; status: string }[] }>(
    request,
    "GET",
    `/leads?folder=spam&q=${id}`
  )
  expect(spam.items).toEqual([
    expect.objectContaining({ name: `Bot ${id}`, status: "spam" }),
  ])
  const inbox = await api<{ total: number }>(request, "GET", `/leads?q=${id}`)
  expect(inbox.total).toBe(0)
})

test("the 6th submission within 10 minutes gets 429", async ({ request }) => {
  const ip = testIp()
  const stamp = await publicStamp(request)
  await new Promise((r) => setTimeout(r, 3_200))
  const statuses: number[] = []
  for (let i = 0; i < 6; i++) {
    const id = unique()
    const res = await postLead(
      request,
      {
        name: `Rate ${id}`,
        email: `rate+${id}@example.com`,
        topic: "something-else",
        consent: true,
        stamp,
      },
      ip
    )
    statuses.push(res.status())
  }
  expect(statuses).toEqual([201, 201, 201, 201, 201, 429])
})
