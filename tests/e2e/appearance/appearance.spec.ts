import { expect, test } from "@playwright/test"

import { api } from "../support/api"
import { STORAGE } from "../support/storage"
import { cssVar, ownerApi, resetTheme } from "../support/theme"

test.describe.configure({ mode: "serial" })
test.afterAll(resetTheme)

test("the default theme emits no theme style (parity guard)", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page.locator("style#theme-tokens")).toHaveCount(0)
  expect(await cssVar(page, "--color-brand")).toBe("#336060")
})

test.describe("as the owner", () => {
  test.use({ storageState: STORAGE.owner })

  test("brand colour → preview → publish → CSS variables change on the next request", async ({
    page,
    browser,
  }) => {
    await page.goto("/admin/appearance")
    await page.getByRole("tab", { name: "Site" }).click()
    const brand = page.getByRole("textbox", { name: "Brand" })
    await brand.fill("#2f5f8a")
    await brand.press("Enter")
    await expect(page.getByText("Draft saved")).toBeVisible()

    // An anonymous visitor never sees the draft (Review Focus 4).
    const anon = await browser.newContext({ storageState: undefined })
    const visitor = await anon.newPage()
    await visitor.goto("/")
    expect(await cssVar(visitor, "--color-brand")).toBe("#336060")

    // Preview on site: draft mode reads the draft.
    const preview = await page.context().newPage()
    await preview.goto("/api/v1/admin/preview?path=/")
    expect(await cssVar(preview, "--color-brand")).toMatch(/^oklch\(/)
    await preview.goto("/api/v1/admin/preview/exit?path=/")

    await page.getByRole("button", { name: "Publish" }).click()
    await expect(page.getByText("Theme published")).toBeVisible()

    await visitor.goto("/")
    const published = await cssVar(visitor, "--color-brand")
    expect(published).toMatch(/^oklch\(/)
    expect(published).not.toBe("#336060")
    await expect(visitor.locator("style#theme-tokens")).toHaveCount(1)
    await anon.close()
  })

  test("failing contrast blocks publishing with an explanation", async ({
    page,
  }) => {
    await page.goto("/admin/appearance")
    await page.getByRole("tab", { name: "Site" }).click()
    await page.getByText("Advanced tokens").click()
    const muted = page.getByRole("textbox", { name: "Muted text" })
    await muted.fill("#dddddd")
    await muted.press("Enter")
    await expect(page.getByText("Draft saved")).toBeVisible()
    await expect(
      page.getByText("Publishing is blocked until every pair passes.")
    ).toBeVisible()
    await expect(
      page.getByText(/Muted text on Cream is \d\.\d{2}:1/).first()
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled()

    // The server enforces it too.
    const req = await ownerApi()
    const doc = await api<{ version: number }>(req, "GET", "/theme")
    const res = await req.fetch("/api/v1/admin/theme/publish", {
      method: "POST",
      data: { version: doc.version },
      headers: { origin: new URL(page.url()).origin },
    })
    expect(res.status()).toBe(400)
    expect(await res.text()).toContain("Muted text on Cream")
    await req.dispose()

    await page.getByRole("button", { name: "Fix all" }).click()
    await expect(page.getByText("Draft saved")).toBeVisible()
    await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled()
    await page.getByRole("button", { name: "Discard draft" }).click()
  })

  test("admin primary publishes to the admin's own variables", async ({
    page,
  }) => {
    const req = await ownerApi()
    let doc = await api<{ version: number }>(req, "GET", "/theme")
    doc = await api(req, "PUT", "/theme/draft", {
      version: doc.version,
      draft: { admin: { primary: "#6a3f6b" } },
    })
    await api(req, "POST", "/theme/publish", { version: doc.version })
    await req.dispose()
    await page.goto("/admin")
    await expect(page.locator("style#theme-tokens")).toHaveCount(1)
    expect(await cssVar(page, "--primary")).toMatch(/^oklch\(/)
  })

  test("reset to preset returns the site to today's palette", async ({
    page,
  }) => {
    await resetTheme()
    await page.goto("/")
    await expect(page.locator("style#theme-tokens")).toHaveCount(0)
    expect(await cssVar(page, "--color-brand")).toBe("#336060")
  })
})
