import { describe, expect, it } from "vitest"

import { withProcessingSlot } from "./process"

describe("withProcessingSlot", () => {
  it("runs two at a time, queues eight and refuses the rest with 503", async () => {
    let active = 0
    let peak = 0
    const gates: (() => void)[] = []
    const job = () =>
      withProcessingSlot(async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise<void>((resolve) => gates.push(resolve))
        active--
      })
    const jobs = Array.from({ length: 10 }, job)
    await expect(job()).rejects.toMatchObject({
      code: "UNAVAILABLE",
      status: 503,
    })
    while (gates.length > 0 || active > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      gates.shift()?.()
    }
    await Promise.all(jobs)
    expect(peak).toBe(2)
    // Every slot is free again afterwards.
    await expect(withProcessingSlot(async () => "ok")).resolves.toBe("ok")
  })
})

describe("processUpload", () => {
  it("refuses a Lottie file over 2.5 MB", async () => {
    const { processUpload } = await import("./process")
    const padding = " ".repeat(2.5 * 1024 * 1024)
    const big = Buffer.from(
      `{"v":"5.7.4","fr":30,"ip":0,"op":60,"w":100,"h":100,"layers":[]${padding}}`
    )
    await expect(processUpload(big, "logo.json")).rejects.toThrow(/2\.5 MB/)
  })
})
