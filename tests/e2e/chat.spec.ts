import { expect, test } from "@playwright/test"

import { E2E_USERS } from "./fixtures/users"
import { disableAi, enableAi } from "./support/ai"
import { api } from "./support/api"
import { setChat } from "./support/chat"
import { testIp } from "./support/public"
import { STORAGE } from "./support/storage"

// Switches shared site settings on: runs in its own invocation
// (playwright.chat.config.ts), like the assistant specs.
test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  await enableAi()
  await setChat(true, true)
})
test.afterAll(async () => {
  await setChat(false, false)
  await disableAi()
})

test("visitor, AI, staff take-over and hand-back", async ({
  browser,
  baseURL,
}) => {
  const visitorCtx = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "x-real-ip": testIp() },
  })
  const visitor = await visitorCtx.newPage()
  await visitor.goto("/")

  // 1-2. Consent, send, AI reply with its caption.
  await visitor.getByRole("button", { name: "Open chat" }).click()
  const dialog = visitor.getByRole("dialog", { name: "Chat with us" })
  await dialog.getByLabel("Name", { exact: true }).fill("Vivian Visitor")
  await dialog.getByLabel("Message", { exact: true }).fill("Hello from the E2E suite")
  await dialog.getByRole("checkbox").check()
  await dialog.getByRole("button", { name: "Start chat" }).click()
  const log = dialog.getByRole("log", { name: "Conversation" })
  await expect(log).toContainText("Hello from the E2E suite")
  await expect(log).toContainText("Assistant · AI", { timeout: 20_000 })
  await expect(log).toContainText("OK")

  // 3. Staff opens the chat and replies.
  const staffCtx = await browser.newContext({
    baseURL,
    storageState: STORAGE.owner,
  })
  const staff = await staffCtx.newPage()
  const list = await api<{ items: { id: string; visitorName: string }[] }>(
    staffCtx.request,
    "GET",
    "/chat?status=open"
  )
  const chat = list.items.find((c) => c.visitorName === "Vivian Visitor")
  expect(chat).toBeTruthy()
  await staff.goto(`/admin/chat?c=${chat!.id}`)
  await expect(
    staff.getByText("Hello from the E2E suite").first()
  ).toBeVisible()
  await staff.getByLabel("Reply").fill("Hi Vivian, this is the team.")
  await staff.getByRole("button", { name: "Send", exact: true }).click()

  // 4. The visitor sees it within 5 s, and the header names the staff member.
  await expect(log).toContainText("Hi Vivian, this is the team.", {
    timeout: 5_000,
  })
  await expect(dialog).toContainText(`Chatting with ${E2E_USERS.shellOwner.name}`)

  // 5. The AI stays quiet while staff own the chat.
  const aiCount = () => log.getByText("Assistant · AI").count()
  const before = await aiCount()
  const sendVisitor = async (text: string) => {
    await dialog.getByLabel("Your message").fill(text)
    await dialog.getByRole("button", { name: "Send", exact: true }).click()
    await expect(log).toContainText(text)
  }
  await sendVisitor("Are you still there?")
  await visitor.waitForTimeout(6_000)
  expect(await aiCount()).toBe(before)

  // 6. Hand back to AI: the next message gets an AI reply.
  await staff.getByRole("button", { name: "Hand back to AI" }).click()
  await expect(staff.getByText("AI is replying")).toBeVisible()
  await sendVisitor("Thanks, one more question")
  await expect(async () => {
    expect(await aiCount()).toBeGreaterThan(before)
  }).toPass({ timeout: 20_000 })

  await staffCtx.close()
  await visitorCtx.close()
})
