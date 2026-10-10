// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ogColors } from "@/lib/seo/og-theme"

import { SocialCard } from "./social-card"

describe("share card preview", () => {
  const card = {
    title: "Typed social title",
    eyebrow: "Anxiety",
    siteName: "Magda Kennedy",
    colors: ogColors({}),
  }

  it("draws the card in the browser when there is no image", () => {
    const { container } = render(
      <SocialCard siteHost="x.ie" title="T" description="D" card={card} />
    )
    expect(
      screen.getByRole("img", { name: "Share image preview" })
    ).toBeTruthy()
    expect(screen.getAllByText("Typed social title").length).toBeGreaterThan(0)
    expect(screen.getByText("Anxiety")).toBeTruthy()
    expect(container.querySelector("img")).toBeNull()
    expect(
      (container.querySelector("[style*='background']") as HTMLElement).style
        .background
    ).toBe("rgb(3, 3, 3)")
  })

  it("prefers an uploaded image over the drawn card", () => {
    const { container } = render(
      <SocialCard
        siteHost="x.ie"
        title="T"
        description="D"
        imageSrc="/uploads/a.png"
        card={card}
      />
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/uploads/a.png"
    )
    expect(screen.queryByText("Anxiety")).toBeNull()
  })
})
