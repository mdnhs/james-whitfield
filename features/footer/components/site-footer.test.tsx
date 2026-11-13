// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { GLOBALS, parseGlobal } from "@/lib/content/globals"

vi.mock("@/components/brand", () => ({ Brand: () => null }))
// The year is a cached server component; the footer markup is what matters.
vi.mock("@/components/copyright-year", () => ({ CopyrightYear: () => "2026" }))
vi.mock("./cookie-settings-button", () => ({
  CookieSettingsButton: () => null,
}))

const { SiteFooter } = await import("./site-footer")

function renderFooter(social: unknown) {
  const footer = parseGlobal("footer", { blurb: "Coach", social })
  return render(
    <SiteFooter
      site={{ name: "Magda Kennedy" }}
      footer={footer}
      contact={parseGlobal("contact", {})}
      navigation={parseGlobal("navigation", {})}
      cookieSettings={null}
    />
  )
}

describe("footer social media", () => {
  it("shows one labelled icon link per profile, in order, opening in a new tab", () => {
    renderFooter([
      { platform: "instagram", url: "https://instagram.com/magda" },
      { platform: "linkedin", url: "https://linkedin.com/in/magda" },
    ])
    const list = screen.getByRole("list", { name: "Social media" })
    const links = within(list).getAllByRole("link")
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
      "Magda Kennedy on Instagram",
      "Magda Kennedy on LinkedIn",
    ])
    expect(links[0]!.getAttribute("href")).toBe("https://instagram.com/magda")
    expect(links[0]!.getAttribute("target")).toBe("_blank")
    expect(links[0]!.getAttribute("rel")).toContain("noopener")
    expect(links[0]!.querySelector("svg")).toBeTruthy()
  })

  it("shows nothing when no profiles are set", () => {
    renderFooter([])
    expect(screen.queryByRole("list", { name: "Social media" })).toBeNull()
  })
})

describe("footer social schema", () => {
  it("accepts known platforms with https links and rejects others", () => {
    expect(
      GLOBALS.footer.safeParse({
        social: [{ platform: "youtube", url: "https://youtube.com/@m" }],
      }).success
    ).toBe(true)
    expect(
      GLOBALS.footer.safeParse({
        social: [{ platform: "myspace", url: "https://myspace.com/m" }],
      }).success
    ).toBe(false)
    expect(
      GLOBALS.footer.safeParse({
        social: [{ platform: "instagram", url: "http://instagram.com/m" }],
      }).success
    ).toBe(false)
    expect(parseGlobal("footer", {}).social).toEqual([])
  })
})
