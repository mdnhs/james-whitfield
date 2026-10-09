import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"

// docs/plan.md Phase 3: warm-cache TTFB under 200 ms locally. Titled "perf:"
// so CI (shared runners) skips it.
test.describe.configure({ mode: "serial" })

test("perf: warm-cache TTFB stays under 200 ms", async ({ request }) => {
  for (const { path } of PARITY_ROUTES) await request.get(path)
  for (const { path } of PARITY_ROUTES) {
    const started = performance.now()
    const response = await request.get(path)
    const elapsed = performance.now() - started
    expect(response.status(), path).toBe(200)
    expect(elapsed, path).toBeLessThan(200)
  }
})
