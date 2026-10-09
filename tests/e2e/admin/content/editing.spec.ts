import { expect, test, type Page } from "@playwright/test"

import { api, createPublishedPage, richTextDocument } from "../../support/api"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

const heroDoc = (mediaId: string, title: string) => ({
  blocks: [
    {
      id: "e2e-home",
      type: "hero.page",
      anchor: "home",
      chapter: "Welcome",
      hidden: false,
      joinPrevious: false,
      data: {
        title,
        subtitle: "Subtitle",
        image: { mediaId },
        focal: null,
        tint: 0.3,
        mirror: false,
      },
    },
    richTextDocument("Body").blocks[0],
  ],
})

// Acceptance: edit the hero → preview shows the draft → publish → the
// public page updates on the next request.
test("edit, preview, publish", async ({ page, browser }) => {
  const { items } = await api<{ items: { id: string }[] }>(
    page.request,
    "GET",
    "/media?pageSize=1&type=image"
  )
  const { id, path } = await createPublishedPage(
    page.request,
    "",
    heroDoc(items[0]!.id, "Old title")
  )
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(path)
  await expect(
    visitor.getByRole("heading", { name: "Old title" })
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
    visitor.getByRole("heading", { name: "Old title" })
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
  const { id } = await createPublishedPage(page.request, "", doc)
  await page.goto(`/admin/pages/${id}`)
  const box = page.getByRole("textbox", { name: "Text" })
  await box.click()
  await page.keyboard.press("Home")
  await page.keyboard.type("Now: ", { delay: 40 })
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  await page.keyboard.type("ok ", { delay: 40 })
  await expect(box).toHaveText("Now: ok See the guide today")
})

async function typeInText(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Text" }).click()
  await page.keyboard.press("End")
  await page.keyboard.type(text)
}

// Publish saves what was just typed first, on the version that results:
// no self-inflicted 409, and the typed words go live.
test("publishing right after typing publishes the typing", async ({
  page,
  browser,
}) => {
  const { id, path } = await createPublishedPage(page.request, "Words")
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
  await page.goto(`/admin/pages/${a.id}`)
  await typeInText(page, " edit")
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  // Client-side navigation keeps the query cache: away to another page's
  // builder (which replaces this one) and back.
  for (const id of [b.id, a.id]) {
    await page.getByRole("link", { name: "Pages", exact: true }).first().click()
    await expect(page).toHaveURL(/\/admin\/pages$/)
    await page.locator(`table a[href="/admin/pages/${id}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/admin/pages/${id}$`))
    await expect(page.getByRole("textbox", { name: "Text" })).toBeVisible()
  }
  await expect(page.getByRole("textbox", { name: "Text" })).toHaveText(
    "First edit"
  )
  await typeInText(page, " again")
  await expect(page.getByText(/^Saved \d+ s ago$/)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
