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
      if (perf < BUDGET.performance)
        failures.push(`${pathname} performance ${perf}`)
    }
  } finally {
    await context.close()
  }
  expect(failures).toEqual([])
})
