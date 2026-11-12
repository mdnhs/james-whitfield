import { expect, test, type Page } from "@playwright/test"

import {
  createPublishedPage,
  createRichTextPage,
  richTextDocument,
  type PageDocument,
} from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

// Home and End do not move the caret on macOS; Cmd+arrows do.
const mac = process.platform === "darwin"
const LINE_START = mac ? "Meta+ArrowLeft" : "Home"
const LINE_END = mac ? "Meta+ArrowRight" : "End"

// Acceptance: edit the hero of a service page's fixed template → preview
// shows the draft → publish → the public page updates on the next request.
test("edit, preview, publish", async ({ page, browser }) => {
  const { id, path, title } = await createPublishedPage(page.request, "Sub")
  const oldTitle = title.slice(0, 40)
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(path)
  await expect(
    visitor.getByRole("heading", { name: oldTitle, level: 1 })
  ).toBeVisible()

  await page.goto(`/admin/pages/${id}`)
  await page.getByRole("button", { name: /^Page hero/ }).click()
  await page
    .getByRole("group", { name: "Page hero" })
    .getByLabel("Title", { exact: true })
    .fill("New title")
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page
      .frameLocator('iframe[title="Page preview"]')
      .getByRole("heading", { name: "New title" })
  ).toBeVisible()

  await visitor.reload()
  await expect(
    visitor.getByRole("heading", { name: oldTitle, level: 1 })
  ).toBeVisible()

  const published = page.waitForResponse(
    (r) => r.url().endsWith(`/pages/${id}/publish`) && r.ok()
  )
  await page.getByRole("button", { name: "Publish" }).click()
  await published
  await visitor.reload()
  await expect(
    visitor.getByRole("heading", { name: "New title" })
  ).toBeVisible()
})

// The rich-text widget re-syncs from the form value; inside the builder the
// value comes back through react-hook-form and autosave, and must never
// reset the editor (which would throw the cursor to the end).
test("typing beside a link keeps the cursor in place", async ({ page }) => {
  const [content] = richTextDocument("").blocks
  const doc = {
    blocks: [
      {
        ...content,
        data: {
          ...content!.data,
          doc: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "See " },
                  {
                    type: "text",
                    text: "the guide",
                    marks: [{ type: "link", attrs: { href: "/about" } }],
                  },
                  { type: "text", text: " today" },
                ],
              },
            ],
          },
        },
      },
    ],
  }
  const { id } = await createRichTextPage(page.request, "", doc as PageDocument)
  await page.goto(`/admin/pages/${id}`)
  const box = page.getByRole("textbox", { name: "Text" })
  await box.click()
  await page.keyboard.press(LINE_START)
  await page.keyboard.type("Now: ", { delay: 40 })
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  await page.keyboard.type("ok ", { delay: 40 })
  await expect(box).toHaveText("Now: ok See the guide today")
})

async function typeInText(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Text" }).click()
  await page.keyboard.press(LINE_END)
  await page.keyboard.type(text)
}

// Publish saves what was just typed first, on the version that results:
// no self-inflicted 409, and the typed words go live.
test("publishing right after typing publishes the typing", async ({
  page,
  browser,
}) => {
  const { id, path } = await createRichTextPage(page.request, "Words")
  await page.goto(`/admin/pages/${id}`)
  await typeInText(page, " typed")
  const published = page.waitForResponse((r) =>
    r.url().endsWith(`/pages/${id}/publish`)
  )
  await page.getByRole("button", { name: "Publish" }).click()
  expect((await published).status()).toBe(200)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("This page changed.")).toHaveCount(0)
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(path)
  await expect(visitor.getByText("Words typed")).toBeVisible()
})

// The detail cache follows each save, and a remounted builder refetches:
// reopening a page never starts from a version it already moved past.
test("reopening a page after editing it saves without a conflict", async ({
  page,
}) => {
  const a = await createPublishedPage(page.request, "First")
  const b = await createPublishedPage(page.request, "Second")
  const subtitle = page
    .getByRole("group", { name: "Page hero" })
    .getByLabel("Subtitle", { exact: true })
  async function openHero() {
    await page.getByRole("button", { name: /^Page hero/ }).click()
    await expect(subtitle).toBeVisible()
  }
  await page.goto(`/admin/pages/${a.id}`)
  await openHero()
  await subtitle.fill("First edit")
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  // Client-side navigation keeps the query cache: back to Website → Services,
  // away to another service page's builder (which replaces this one) and back.
  for (const { id, title } of [b, a]) {
    await page
      .getByRole("link", { name: "Services", exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/admin\/website\/services$/)
    await page
      .getByRole("listitem")
      .filter({ hasText: title })
      .getByRole("link", { name: "Edit page" })
      .click()
    await expect(page).toHaveURL(new RegExp(`/admin/pages/${id}$`))
    await openHero()
  }
  await expect(subtitle).toHaveValue("First edit")
  await subtitle.fill("First edit again")
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
