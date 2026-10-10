import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { startScheduler } from "./instrumentation.node"

const g = globalThis as { __mkScheduler?: ReturnType<typeof setInterval> }

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}"))
  )
})
afterEach(() => {
  if (g.__mkScheduler) clearInterval(g.__mkScheduler)
  delete g.__mkScheduler
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("startScheduler", () => {
  it("posts the tick every 60 s with the bearer secret, once per process", async () => {
    vi.stubEnv("CRON_SECRET", "s".repeat(32))
    vi.stubEnv("PORT", "4000")
    startScheduler()
    startScheduler()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/v1/cron/tick",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: `Bearer ${"s".repeat(32)}` },
      })
    )
  })
  // TEST_ENV sets CRON_SECRET, so "no secret" blanks it explicitly.
  it.each([
    ["no secret", { CRON_SECRET: "" }],
    ["SCHEDULER=off", { CRON_SECRET: "s".repeat(32), SCHEDULER: "off" }],
  ])("stays off with %s", async (_, env) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string)
    vi.spyOn(console, "warn").mockImplementation(() => {})
    startScheduler()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetch).not.toHaveBeenCalled()
  })
})
