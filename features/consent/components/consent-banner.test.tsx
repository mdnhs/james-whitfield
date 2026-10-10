// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ConsentBanner } from "./consent-banner"

vi.mock("@/lib/tracking/consent-client", () => ({
  getConsentSnapshot: () => null,
  OPEN_CONSENT_EVENT: "mk:open-consent",
  saveConsent: vi.fn(),
}))

const copy = {
  title: "Your privacy",
  body: "Body text",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  policyLabel: "Privacy policy",
  policyHref: "/privacy",
  categories: { necessary: "N", analytics: "A", marketing: "M" },
}
const policy = { version: 1, months: 6 }

afterEach(() => {
  document.body.innerHTML = ""
})

describe("ConsentBanner focus", () => {
  it("returns focus to the footer Cookie settings trigger when it closes", async () => {
    render(
      <>
        <main>content</main>
        <button data-cookie-settings>Cookie settings</button>
        <ConsentBanner copy={copy} policy={policy} />
      </>
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Customise" }))
    await user.click(screen.getByRole("button", { name: "Save choices" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cookie settings" })
    )
  })

  it("falls back to <main> when there is no trigger", async () => {
    render(
      <>
        <main>content</main>
        <ConsentBanner copy={copy} policy={policy} />
      </>
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Reject all" }))
    expect(document.activeElement).toBe(document.querySelector("main"))
  })
})
