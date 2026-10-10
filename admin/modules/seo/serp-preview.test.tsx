// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SerpPreview, serpUrl } from "./serp-preview"
import { SocialCard } from "./social-card"

describe("previews", () => {
  it("shows the URL, title and description as a result would", () => {
    render(
      <SerpPreview
        url="magdakennedy.ie › about"
        title="About | Magda Kennedy"
        description="Who I am."
      />
    )
    expect(screen.getByText("magdakennedy.ie › about")).toBeTruthy()
    expect(screen.getByText("About | Magda Kennedy")).toBeTruthy()
  })
  it("falls back to a placeholder description", () => {
    render(<SerpPreview url="x" title="T" description="" />)
    expect(screen.getByText("No description yet.")).toBeTruthy()
  })
  it("prints the address as host › segments", () => {
    expect(serpUrl("magdakennedy.ie", "/insights/a")).toBe(
      "magdakennedy.ie › insights › a"
    )
    expect(serpUrl("magdakennedy.ie", "/")).toBe("magdakennedy.ie")
  })
  it("renders the social card with its image", () => {
    render(
      <SocialCard
        siteHost="magdakennedy.ie"
        title="Meet Magda"
        description="Who I am."
        imageSrc="/og/about?v=1"
      />
    )
    expect(
      screen
        .getByRole("img", { name: "Share image preview" })
        .getAttribute("src")
    ).toBe("/og/about?v=1")
  })
})
