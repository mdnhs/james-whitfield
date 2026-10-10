import { expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

const head = (
  page: import("@playwright/test").Page,
  selector: string,
  attr = "content"
) => page.locator(`head ${selector}`).first().getAttribute(attr)

test("an inner page carries full metadata in <head>", async ({ page }) => {
  await page.goto("/about")
  await expect(page).toHaveTitle(/\| /)
  expect(await head(page, 'link[rel="canonical"]', "href")).toBe(
    `${E2E_ORIGIN}/about`
  )
  expect(await head(page, 'meta[name="description"]')).toBeTruthy()
  expect(await head(page, 'meta[property="og:locale"]')).toBe("en_IE")
  expect(await head(page, 'meta[property="og:image"]')).toMatch(
    new RegExp(`^${E2E_ORIGIN}/og/about\\?v=[0-9a-f]{8}$`)
  )
  expect(await head(page, 'meta[name="twitter:card"]')).toBe(
    "summary_large_image"
  )
  expect(await page.locator('head meta[name="robots"]').count()).toBe(0)
})

test("the article is an og:article with its dates", async ({ page }) => {
  await page.goto("/insights/calm-is-a-skill")
  expect(await head(page, 'meta[property="og:type"]')).toBe("article")
  expect(
    await head(page, 'meta[property="article:published_time"]')
  ).toBeTruthy()
  expect(await head(page, 'link[rel="canonical"]', "href")).toBe(
    `${E2E_ORIGIN}/insights/calm-is-a-skill`
  )
})

test("a trailing slash 308s to the canonical path", async ({ request }) => {
  const res = await request.get("/about/", { maxRedirects: 0 })
  expect(res.status()).toBe(308)
  expect(res.headers()["location"]).toBe("/about")
})

test("robots.txt disallows everything outside production (acceptance)", async ({
  request,
}) => {
  // E2E runs SITE_ENV=development, the same branch staging takes.
  const body = await (await request.get("/robots.txt")).text()
  expect(body).toMatch(/User-Agent: \*\s+Disallow: \/\s*$/m)
  expect(body).not.toContain("Sitemap:")
})

test("sitemap.xml lists live pages and articles only", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text()
  for (const path of ["/about", "/services", "/insights/calm-is-a-skill"]) {
    expect(xml).toContain(`<loc>${E2E_ORIGIN}${path}</loc>`)
  }
  expect(xml).not.toContain("/privacy")
  expect(xml).toContain("<lastmod>")
})

test("manifest.webmanifest names the site", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json()
  expect(manifest).toMatchObject({ start_url: "/", lang: "en-IE" })
})
