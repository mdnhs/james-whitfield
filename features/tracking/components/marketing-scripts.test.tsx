// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarketingScripts } from "./marketing-scripts"

let pathname = "/"
vi.mock("next/navigation", () => ({ usePathname: () => pathname }))

type W = { __mkConsent?: unknown; fbq?: { queue: unknown[][] } }
const w = window as unknown as W
const scripts = () =>
  Array.from(document.head.querySelectorAll("script")).filter((s) =>
    s.src.includes("fbevents.js")
  )
const go = (url: string) => {
  window.history.replaceState(null, "", url)
  pathname = new URL(url, "https://site.ie").pathname
}
const PIXEL = "1234567890"

beforeEach(() => {
  delete w.fbq
  delete (window as unknown as { _fbq?: unknown })._fbq
  w.__mkConsent = { analytics: true, marketing: true }
  document.head.innerHTML = ""
})
afterEach(() => {
  delete w.__mkConsent
})

describe("MarketingScripts (Ruling R7)", () => {
  it("never loads fbevents on a newsletter token URL or an article", () => {
    for (const url of [
      "/newsletter/x?token=1",
      "/insights/hypnosis-for-panic",
    ]) {
      go(url)
      render(<MarketingScripts pixelId={PIXEL} />).unmount()
      expect(scripts()).toHaveLength(0)
      expect(w.fbq).toBeUndefined()
    }
  })
  it("does not load without marketing consent", () => {
    w.__mkConsent = { analytics: true, marketing: false }
    go("/about")
    render(<MarketingScripts pixelId={PIXEL} />)
    expect(scripts()).toHaveLength(0)
  })
  it("loads on an allowed path with consent", () => {
    go("/about")
    render(<MarketingScripts pixelId={PIXEL} />)
    expect(scripts()).toHaveLength(1)
  })
  it("loads lazily on reaching an allowed route and never PageViews on a disallowed one", () => {
    go("/insights/hypnosis-for-panic")
    const { rerender } = render(<MarketingScripts pixelId={PIXEL} />)
    expect(scripts()).toHaveLength(0)
    go("/contact")
    rerender(<MarketingScripts pixelId={PIXEL} />)
    expect(scripts()).toHaveLength(1)
    const before = w.fbq!.queue.length
    go("/newsletter/unsubscribe?token=a")
    rerender(<MarketingScripts pixelId={PIXEL} />)
    expect(scripts()).toHaveLength(1)
    expect(w.fbq!.queue).toHaveLength(before)
    expect(w.fbq!.queue.some((q) => q.includes("PageView"))).toBe(false)
  })
})
