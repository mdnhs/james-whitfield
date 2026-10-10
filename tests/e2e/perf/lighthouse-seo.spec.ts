import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium, expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

const PORT = 9334
// Ruling R20: the five key pages.
const KEY_PAGES = [
  "/",
  "/about",
  "/services",
  "/insights",
  "/insights/calm-is-a-skill",
]

// Local only (CI skips titles starting "lighthouse:"); the import is lazy so
// loading this file never needs Lighthouse.
test("lighthouse: SEO is 100 on the five key pages", async () => {
  test.skip(test.info().project.name !== "desktop", "one run is enough")
  test.setTimeout(300_000)
  const { default: lighthouse } = await import("lighthouse")
  const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), "mk-lh-seo-")),
    { args: [`--remote-debugging-port=${PORT}`] }
  )
  try {
    for (const pathname of KEY_PAGES) {
      const result = await lighthouse(`${E2E_ORIGIN}${pathname}`, {
        port: PORT,
        onlyCategories: ["seo"],
        // E2E runs SITE_ENV=development, where robots.txt blocks all crawlers
        // by design (Ruling R14); production is covered by robots.test.ts.
        skipAudits: ["is-crawlable"],
        logLevel: "error",
        output: "json",
      })
      const failing = Object.values(result?.lhr.audits ?? {})
        .filter((a) => a.score === 0)
        .map((a) => a.id)
      const score = Math.round((result?.lhr.categories.seo?.score ?? 0) * 100)
      expect(score, `${pathname} SEO (failing: ${failing.join(", ")})`).toBe(
        100
      )
    }
  } finally {
    await context.close()
  }
})
