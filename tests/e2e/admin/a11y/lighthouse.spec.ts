import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium, expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../../fixtures/env"
import { STORAGE } from "../../support/storage"

const PORT = 9333

// Acceptance: Lighthouse accessibility ≥ 95 on /admin. Lighthouse drives
// its own tab, so it runs in a persistent context that holds the owner's
// cookies and exposes a debugging port. It runs locally only (Lighthouse
// 13.5 needs Node ≥ 22.19): CI skips titles starting "lighthouse:", and the
// import is lazy so loading this file never needs it.
test("lighthouse: accessibility is at least 95 on /admin", async () => {
  test.skip(test.info().project.name !== "admin-desktop", "one run is enough")
  test.setTimeout(120_000)
  const { default: lighthouse } = await import("lighthouse")
  const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), "mk-lighthouse-")),
    { args: [`--remote-debugging-port=${PORT}`] }
  )
  try {
    const { cookies } = JSON.parse(readFileSync(STORAGE.owner, "utf8")) as {
      cookies: Parameters<typeof context.addCookies>[0]
    }
    await context.addCookies(cookies)
    const result = await lighthouse(`${E2E_ORIGIN}/admin`, {
      port: PORT,
      onlyCategories: ["accessibility"],
      disableStorageReset: true,
      logLevel: "error",
      output: "json",
    })
    // A lost session would audit the sign-in page instead.
    expect(result?.lhr.finalDisplayedUrl).toBe(`${E2E_ORIGIN}/admin`)
    const category = result?.lhr.categories.accessibility
    const failing = Object.values(result?.lhr.audits ?? {})
      .filter((audit) => audit.score === 0)
      .map((audit) => audit.id)
    const score = Math.round((category?.score ?? 0) * 100)
    test.info().annotations.push({ type: "score", description: String(score) })
    expect(
      score,
      `Lighthouse accessibility (failing: ${failing.join(", ")})`
    ).toBeGreaterThanOrEqual(95)
  } finally {
    await context.close()
  }
})
