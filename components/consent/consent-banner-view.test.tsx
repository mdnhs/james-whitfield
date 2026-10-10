// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ConsentBannerView } from "./consent-banner-view"

const copy = {
  title: "Your privacy",
  body: "Body text",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  policyLabel: "Privacy policy",
  policyHref: "/privacy",
  categories: {
    necessary: "Necessary text",
    analytics: "Analytics text",
    marketing: "Marketing text",
  },
}
const handlers = () => ({
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onCustomise: vi.fn(),
  onSave: vi.fn(),
  onToggle: vi.fn(),
})

describe("ConsentBannerView", () => {
  it("gives Accept, Reject and Customise equal prominence on the first layer", () => {
    render(
      <ConsentBannerView
        copy={copy}
        mode="first"
        choice={{ analytics: false, marketing: false }}
        {...handlers()}
      />
    )
    const dialog = screen.getByRole("dialog", { name: "Your privacy" })
    expect(dialog.getAttribute("aria-modal")).toBe("false")
    const buttons = ["Accept all", "Reject all", "Customise"].map((name) =>
      screen.getByRole("button", { name })
    )
    const classes = new Set(buttons.map((b) => b.className))
    expect(classes.size).toBe(1)
    expect(
      screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")
    ).toBe("/privacy")
  })

  it("Customise shows unticked categories and an always-on necessary row", async () => {
    const h = handlers()
    render(
      <ConsentBannerView
        copy={copy}
        mode="custom"
        choice={{ analytics: false, marketing: false }}
        {...h}
      />
    )
    const necessary = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /Necessary/,
    })
    expect(necessary.checked).toBe(true)
    expect(necessary.disabled).toBe(true)
    const analytics = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /Analytics/,
    })
    const marketing = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /Marketing/,
    })
    expect(analytics.checked).toBe(false)
    expect(marketing.checked).toBe(false)
    await userEvent.click(analytics)
    expect(h.onToggle).toHaveBeenCalledWith("analytics", true)
    await userEvent.click(screen.getByRole("button", { name: "Save choices" }))
    expect(h.onSave).toHaveBeenCalledOnce()
    // Reject stays one click away on the second layer too.
    expect(screen.getByRole("button", { name: "Reject all" })).toBeTruthy()
  })
})
