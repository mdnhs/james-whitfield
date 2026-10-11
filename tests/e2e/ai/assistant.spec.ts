// tests/e2e/ai/assistant.spec.ts
import AxeBuilder from "@axe-core/playwright"
import {
  expect,
  request as playwrightRequest,
  test,
  type Page,
} from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { disableAi, enableAi } from "../support/ai"
import { api } from "../support/api"
import { STORAGE } from "../support/storage"

test.describe.configure({ mode: "serial" })
test.use({ storageState: STORAGE.owner })
test.afterAll(disableAi)

test("owners see the button before Enquiries and a set-up link while it is off", async ({
  page,
}) => {
  await disableAi()
  await page.goto("/admin")
  // The button appears once the status query answers.
  await expect(page.getByRole("button", { name: "AI assistant" })).toBeVisible()
  const header = page.locator("header").first()
  const order = await header
    .locator('[aria-label="AI assistant"], [aria-label="Enquiries"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
  expect(order).toEqual(["AI assistant", "Enquiries"])
  await page.getByRole("button", { name: "AI assistant" }).click()
  await expect(
    page.getByRole("link", { name: "Set up AI assistant" })
  ).toHaveAttribute("href", "/admin/settings/ai-assistant")
})

test("settings save a key and test the connection", async ({ page }) => {
  await page.goto("/admin/settings/ai-assistant")
  await expect(
    page.getByRole("heading", { level: 1, name: "AI assistant" })
  ).toBeVisible()
  await page.getByLabel("API key").fill("e2e-not-a-real-key-0000")
  await page.getByRole("switch", { name: "Turn on the AI assistant" }).click()
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await expect(page.getByText(/ending ••••0000/)).toBeVisible()
  await page.getByRole("button", { name: "Test connection" }).click()
  await expect(
    page.getByText(/Connected: gemini-flash-latest replied/)
  ).toBeVisible()
})

test("⌘J opens and closes the sheet and focus returns to the button", async ({
  page,
}) => {
  await enableAi()
  await page.goto("/admin")
  const button = page.getByRole("button", { name: "AI assistant" })
  await expect(button).toBeVisible()
  await page.keyboard.press("ControlOrMeta+j")
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  await expect(sheet).toBeVisible()
  await page.keyboard.press("ControlOrMeta+j")
  await expect(sheet).toBeHidden()
  await expect(button).toBeFocused()
})

test("streams the reply word by word, copies it, and keeps it across navigation", async ({
  page,
}) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  await sheet
    .getByLabel("Message the AI assistant")
    .fill("Hello there from the E2E suite")
  await sheet.getByLabel("Message the AI assistant").press("Enter")
  const log = sheet.getByRole("log")
  // Review Focus 5: a partial reply is visible before the whole one.
  await expect(log).toContainText("Mock reply:")
  await expect(log).toContainText("Mock reply: Hello there from the E2E suite")
  await sheet.getByRole("button", { name: "Copy" }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Mock reply: Hello there from the E2E suite"
  )
  await page.keyboard.press("Escape")
  // A client-side navigation (page.goto would reload and drop the state).
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Pages", exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/admin\/pages$/)
  await page.getByRole("button", { name: "AI assistant" }).click()
  await expect(page.getByRole("log")).toContainText(
    "Hello there from the E2E suite"
  )
})

test("tool use shows a Looked at line", async ({ page }) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  await sheet.getByRole("button", { name: "New chat" }).click()
  await sheet
    .getByRole("button", { name: "Which pages need SEO work?" })
    .click()
  await sheet.getByRole("button", { name: "Send" }).click()
  await expect(sheet.getByText("Looked at: SEO health")).toBeVisible()
  await expect(sheet.getByRole("log")).toContainText(
    "I looked at the SEO health report."
  )
})

test("history reopens and deletes a conversation", async ({ page }) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  await sheet.getByRole("button", { name: "New chat" }).click()
  await expect(
    sheet.getByRole("button", { name: "Which pages need SEO work?" })
  ).toBeVisible()
  await sheet.getByRole("button", { name: "History" }).click()
  const past = page.getByRole("list", { name: "Past conversations" })
  await past
    .getByRole("button", { name: /^Hello there from the E2E suite/ })
    .click()
  await expect(sheet.getByRole("log")).toContainText(
    "Mock reply: Hello there from the E2E suite"
  )
  await sheet.getByRole("button", { name: "History" }).click()
  await page
    .getByRole("button", { name: /^Delete “Hello there from the E2E suite/ })
    .click()
  await expect(
    page.getByRole("button", {
      name: /^Delete “Hello there from the E2E suite/,
    })
  ).toHaveCount(0)
})

test("Stop aborts the request and the partial reply is saved", async ({
  page,
}) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  await sheet.getByRole("button", { name: "New chat" }).click()
  // 120 words at 30 ms each: about 3.6 s, long enough to stop mid-stream.
  const words = Array.from({ length: 120 }, (_, i) => `w${i}`)
  const text = `Stop test ${words.join(" ")}`
  const chat = page.waitForRequest((r) => r.url().endsWith("/ai/chat"))
  const box = sheet.getByLabel("Message the AI assistant")
  await box.fill(text)
  await box.press("Enter")
  await chat
  await expect(sheet.getByRole("log")).toContainText("Mock reply: Stop test")
  await sheet.getByRole("button", { name: "Stop" }).click()
  await expect(sheet.getByRole("button", { name: "Send" })).toBeVisible()

  // The server saved the part that streamed, not the whole reply.
  const owner = await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
  type Part = { type: string; text?: string }
  type Message = { role: string; parts: Part[] }
  let reply = ""
  await expect
    .poll(async () => {
      const { items } = await api<{ items: { id: string; title: string }[] }>(
        owner,
        "GET",
        "/ai/conversations"
      )
      const hit = items.find((c) => c.title.startsWith("Stop test"))
      if (!hit) return ""
      const conv = await api<{ messages: Message[] }>(
        owner,
        "GET",
        `/ai/conversations/${hit.id}`
      )
      const last = conv.messages.at(-1)
      reply =
        last?.role === "assistant"
          ? last.parts.map((p) => p.text ?? "").join("")
          : ""
      return reply
    })
    .toContain("Mock reply: Stop test")
  expect(reply).not.toContain("w119")
  const audit = await api<unknown>(owner, "GET", "/audit")
  expect(JSON.stringify(audit)).toContain("· stopped)")
  await owner.dispose()
})

type ChatBody = {
  conversationId?: string | null
  text?: string
  regenerate?: boolean
  editMessageId?: string
  context?: { path: string; entity?: { type: string; id: string } }
}
type Part = { type: string; text?: string }
type Message = { id: string; role: string; parts: Part[] }

async function ownerApi() {
  return playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
}
async function savedMessages(title: string) {
  const owner = await ownerApi()
  const { items } = await api<{ items: { id: string; title: string }[] }>(
    owner,
    "GET",
    "/ai/conversations"
  )
  const hit = items.find((c) => c.title === title)
  const conv = hit
    ? await api<{ messages: Message[] }>(
        owner,
        "GET",
        `/ai/conversations/${hit.id}`
      )
    : { messages: [] }
  await owner.dispose()
  return conv.messages.map(
    (m) => `${m.role}:${m.parts.map((p) => p.text ?? "").join("")}`
  )
}
const chatRequest = (page: Page) =>
  page.waitForRequest((r) => r.url().endsWith("/ai/chat"))

test("Expand widens the panel to half the window and is remembered", async ({
  page,
}) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  await expect(sheet).toBeVisible()
  const width = async () => (await sheet.boundingBox())!.width
  await expect.poll(width).toBeGreaterThanOrEqual(480)
  expect(await width()).toBeLessThanOrEqual(560)
  const expand = sheet.getByRole("button", { name: "Expand" })
  await expect(expand).toHaveAttribute("aria-pressed", "false")
  await expand.click()
  await expect(expand).toHaveAttribute("aria-pressed", "true")
  await expect.poll(width).toBeCloseTo(720, -1)
  await page.reload()
  await page.getByRole("button", { name: "AI assistant" }).click()
  await expect(sheet.getByRole("button", { name: "Expand" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect.poll(width).toBeCloseTo(720, -1)
  await sheet.getByRole("button", { name: "Expand" }).click()
  await expect.poll(width).toBeLessThanOrEqual(560)
  await sheet.getByRole("button", { name: "Close" }).click()
  await expect(sheet).toBeHidden()
})

test("in a page editor the starters and the next message are about that page", async ({
  page,
}) => {
  const owner = await ownerApi()
  const { items } = await api<{ items: { id: string; title: string }[] }>(
    owner,
    "GET",
    "/pages"
  )
  await owner.dispose()
  const target = items[0]!
  await page.goto(`/admin/pages/${target.id}`)
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  await expect(
    sheet.getByRole("button", { name: "Check this page's SEO" })
  ).toBeVisible()
  await expect(
    sheet.getByRole("button", { name: "Which pages need SEO work?" })
  ).toHaveCount(0)
  await expect(sheet.getByText(`${target.title} page`)).toBeVisible()

  await sheet
    .getByRole("button", { name: "Write a meta description for this page" })
    .click()
  let request = chatRequest(page)
  await sheet.getByRole("button", { name: "Send" }).click()
  const body = (await request).postDataJSON() as ChatBody
  expect(body).toEqual({
    conversationId: null,
    text: "Write a meta description for this page",
    context: {
      path: `/admin/pages/${target.id}`,
      entity: { type: "page", id: target.id },
    },
  })
  const log = sheet.getByRole("log")
  await expect(log).toContainText(
    "Mock reply: Write a meta description for this page"
  )

  // The chip's ✕ leaves the page out of the next message only.
  await sheet
    .getByRole("button", { name: /^Don't use .+ for the next message$/ })
    .click()
  await expect(sheet.getByText(`${target.title} page`)).toHaveCount(0)
  request = chatRequest(page)
  await sheet.getByLabel("Message the AI assistant").fill("Without the page")
  await sheet.getByLabel("Message the AI assistant").press("Enter")
  const second = (await request).postDataJSON() as ChatBody
  expect(second.context).toBeUndefined()
  expect(second.conversationId).toEqual(expect.any(String))
  await expect(sheet.getByText(`${target.title} page`)).toBeVisible()
  await expect(log).toContainText("Mock reply: Without the page")
})

test("Regenerate re-runs the last turn and replaces its reply", async ({
  page,
}) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  const log = sheet.getByRole("log")
  await sheet.getByLabel("Message the AI assistant").fill("Regenerate this one")
  await sheet.getByLabel("Message the AI assistant").press("Enter")
  await expect(log).toContainText("Mock reply: Regenerate this one")
  const regenerate = sheet.getByRole("button", { name: "Regenerate" })
  await expect(regenerate).toBeVisible()

  const request = chatRequest(page)
  await regenerate.click()
  const body = (await request).postDataJSON() as ChatBody
  expect(body).toMatchObject({
    conversationId: expect.any(String),
    regenerate: true,
  })
  expect(body.text).toBeUndefined()
  await expect(regenerate).toBeVisible()
  await expect(log.getByText("Mock reply: Regenerate this one")).toHaveCount(1)
  await expect
    .poll(() => savedMessages("Regenerate this one"))
    .toEqual([
      "user:Regenerate this one",
      "assistant:Mock reply: Regenerate this one",
    ])
})

test("Edit replaces the last message and the reply after it", async ({
  page,
}) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "AI assistant" }).click()
  const sheet = page.getByRole("dialog", { name: "AI assistant" })
  const log = sheet.getByRole("log")
  await sheet
    .getByLabel("Message the AI assistant")
    .fill("Edit test first draft")
  await sheet.getByLabel("Message the AI assistant").press("Enter")
  await expect(log).toContainText("Mock reply: Edit test first draft")

  await sheet.getByRole("button", { name: "Edit" }).click()
  const edit = sheet.getByLabel("Edit your message")
  await expect(edit).toBeFocused()
  await edit.fill("Edit test second draft")
  const request = chatRequest(page)
  await sheet.getByRole("button", { name: "Save" }).click()
  const body = (await request).postDataJSON() as ChatBody
  expect(body).toMatchObject({
    conversationId: expect.any(String),
    text: "Edit test second draft",
    editMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  })
  await expect(log).toContainText("Mock reply: Edit test second draft")
  await expect(log).not.toContainText("first draft")
  // The title stays the first message's; the turns are the edited ones.
  await expect
    .poll(() => savedMessages("Edit test first draft"))
    .toEqual([
      "user:Edit test second draft",
      "assistant:Mock reply: Edit test second draft",
    ])
})

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe: the open sheet has no serious or critical violations (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme })
    await page.goto("/admin")
    await page.getByRole("button", { name: "AI assistant" }).click()
    const sheet = page.getByRole("dialog", { name: "AI assistant" })
    await expect(sheet).toBeVisible()
    const audit = async () => {
      // The sheet fades in; axe must measure the settled colours.
      await sheet.evaluate((el) =>
        Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
      )
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .include('[data-slot="sheet-content"]')
        .analyze()
      return violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.id)
    }
    // The empty state: greeting and starter cards.
    expect(await audit()).toEqual([])
    // A conversation: bubbles, a Markdown reply and its actions.
    await sheet
      .getByLabel("Message the AI assistant")
      .fill(`Axe check in ${colorScheme}`)
    await sheet.getByLabel("Message the AI assistant").press("Enter")
    await expect(
      sheet.getByRole("button", { name: "Regenerate" })
    ).toBeVisible()
    expect(await audit()).toEqual([])
  })
}
