import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium, expect, test } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

const PORT = 9334
// docs/brief.md §3 criterion 5 (Phase 7 Ruling R20: the five key pages).
export const KEY_PAGES = [
  "/",
  "/about",
  "/services",
  "/insights",
  "/insights/calm-is-a-skill",
]
const BUDGET = { seo: 100, accessibility: 95, performance: 90 }
// Ruling R10: performance is the median of three mobile runs.
const RUNS = 3
// Known exception (Phase 11 Task 4, controller ruling): on localhost the
// article's h1 paints in the same ~60 ms window in which every script and
// font finishes, so Lantern's simulation lands at 85-90. Re-measure on
// staging; until then a miss on these pages is annotated, not failed. The
// budget itself is unchanged, and SEO/accessibility still fail as normal.
const REMEASURE_ON_STAGING = new Set(["/insights/calm-is-a-skill"])

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

test("lighthouse: key pages meet the §3 budgets on mobile", async () => {
  test.skip(test.info().project.name !== "desktop", "one run is enough")
  test.setTimeout(1_200_000)
  const { default: lighthouse } = await import("lighthouse")
  const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), "mk-lh-")),
    {
      args: [`--remote-debugging-port=${PORT}`],
    }
  )
  const failures: string[] = []
  try {
    for (const pathname of KEY_PAGES) {
      const performance: number[] = []
      for (let run = 0; run < RUNS; run++) {
        const result = await lighthouse(`${E2E_ORIGIN}${pathname}`, {
          port: PORT,
          // Lighthouse's default config is mobile with simulated throttling.
          onlyCategories:
            run === 0
              ? ["performance", "accessibility", "seo"]
              : ["performance"],
          // E2E runs SITE_ENV=development, where robots.txt blocks crawlers
          // by design (Phase 7 R14); production is covered by robots.test.ts.
          skipAudits: ["is-crawlable"],
          logLevel: "error",
          output: "json",
        })
        const lhr = result?.lhr
        const score = (id: string) =>
          Math.round((lhr?.categories[id]?.score ?? 0) * 100)
        performance.push(score("performance"))
        if (run === 0) {
          const failing = Object.values(lhr?.audits ?? {})
            .filter((a) => a.score === 0)
            .map((a) => a.id)
          for (const category of ["seo", "accessibility"] as const) {
            if (score(category) < BUDGET[category])
              failures.push(
                `${pathname} ${category} ${score(category)} (failing: ${failing.join(", ")})`
              )
          }
        }
      }
      const perf = median(performance)
      console.log(
        `[lighthouse] ${pathname} performance ${performance.join("/")} → ${perf}`
      )
      if (perf < BUDGET.performance) {
        if (REMEASURE_ON_STAGING.has(pathname))
          test.info().annotations.push({
            type: "re-measure on staging",
            description: `${pathname} performance ${perf} < ${BUDGET.performance}`,
          })
        else failures.push(`${pathname} performance ${perf}`)
      }
    }
  } finally {
    await context.close()
  }
  expect(failures).toEqual([])
})
