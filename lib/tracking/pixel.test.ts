import { describe, expect, it } from "vitest"

import { loadPixel } from "./pixel"

function env() {
  const appended: { async?: boolean; src?: string }[] = []
  const window: Record<string, unknown> = {}
  const document = {
    createElement: () => ({}),
    head: { appendChild: (el: { src?: string }) => appended.push(el) },
  }
  return { window, document, appended }
}

describe("loadPixel (brief §12.4)", () => {
  it("turns off autoConfig before init and history PageViews, and queues no PageView", () => {
    const t = env()
    expect(loadPixel("1234567890", t as never)).toBe(true)
    const fbq = t.window.fbq as {
      queue: unknown[][]
      disablePushState: boolean
    }
    expect(fbq.disablePushState).toBe(true)
    expect(fbq.queue).toEqual([
      ["set", "autoConfig", false, "1234567890"],
      ["init", "1234567890"],
    ])
    expect(t.appended).toEqual([
      { async: true, src: "https://connect.facebook.net/en_US/fbevents.js" },
    ])
  })

  it("loads once and refuses an invalid ID", () => {
    const t = env()
    loadPixel("1234567890", t as never)
    expect(loadPixel("1234567890", t as never)).toBe(false)
    expect(t.appended).toHaveLength(1)
    const u = env()
    expect(loadPixel("12345", u as never)).toBe(false)
    expect(u.window.fbq).toBeUndefined()
  })
})
