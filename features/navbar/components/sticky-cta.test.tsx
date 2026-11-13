// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { StickyCta } from "./sticky-cta"

vi.mock("next/navigation", () => ({ usePathname: () => "/about" }))

const props = {
  cta: { label: "Book a Call", href: "/contact" },
  phone: { display: "", e164: "" },
  callLabel: "Call",
}
const readVar = () =>
  document.documentElement.style.getPropertyValue("--sticky-cta-h")

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ""
  document.documentElement.style.removeProperty("--sticky-cta-h")
})

describe("StickyCta height variable", () => {
  it("publishes the bar height when shown and 0px on unmount", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(92)
    const { unmount } = render(<StickyCta {...props} />)
    await waitFor(() => expect(readVar()).toBe("92px"))
    unmount()
    expect(readVar()).toBe("0px")
  })

  it("is 0px while a page CTA covers the bar", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(92)
    const main = document.createElement("main")
    const link = document.createElement("a")
    link.setAttribute("href", "/contact")
    main.append(link)
    document.body.append(main)
    link.getBoundingClientRect = () =>
      ({
        width: 100,
        height: 40,
        top: 100,
        bottom: 140,
        left: 0,
        right: 100,
      }) as DOMRect
    document.elementFromPoint = () => link
    render(<StickyCta {...props} />)
    await new Promise((r) => setTimeout(r, 50))
    expect(readVar()).toBe("0px")
  })
})
