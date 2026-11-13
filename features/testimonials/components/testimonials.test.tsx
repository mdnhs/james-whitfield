// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { TestimonialView } from "@/lib/content/types"

import { GoogleSummary } from "./google-summary"
import { TestimonialCard } from "./testimonial-card"

const avatar = {
  id: "m1",
  src: "/a.png",
  width: 60,
  height: 60,
  blurDataURL: null,
  alt: "",
  focal: null,
}
const site: TestimonialView = {
  id: "1",
  quote: "Great",
  name: "Ann Lee",
  role: "Client",
  avatar,
  source: "site",
  rating: 5,
  reviewUrl: "",
}
const google: TestimonialView = {
  ...site,
  id: "2",
  source: "google",
  rating: 4,
  reviewUrl: "https://g.co/r/2",
}

describe("TestimonialCard", () => {
  it("renders stars, the G mark and a Google link for a Google review", () => {
    render(<TestimonialCard item={google} />)
    expect(screen.getByLabelText("Rated 4 out of 5")).toBeTruthy()
    expect(screen.getByLabelText("Google review")).toBeTruthy()
    const link = screen.getByText("View on Google").closest("a")!
    expect(link.getAttribute("href")).toBe("https://g.co/r/2")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
  })
  it("leaves a website card without stars or mark", () => {
    render(<TestimonialCard item={site} />)
    expect(screen.queryByLabelText(/Rated/)).toBeNull()
    expect(screen.queryByLabelText("Google review")).toBeNull()
  })
  it("omits the link without a review url", () => {
    render(<TestimonialCard item={{ ...google, reviewUrl: "" }} />)
    expect(screen.queryByText("View on Google")).toBeNull()
  })
  it("shows initials without an avatar", () => {
    const { container } = render(
      <TestimonialCard item={{ ...site, avatar: null }} />
    )
    expect(screen.getByText("AL")).toBeTruthy()
    expect(container.querySelector("img")).toBeNull()
  })
})

describe("GoogleSummary", () => {
  const g = { rating: 4.9, count: 23, profileUrl: "", writeUrl: "" }
  it("renders only when the rating is set and show is not site", () => {
    const { container, rerender } = render(
      <GoogleSummary show="all" google={g} />
    )
    expect(screen.getByText("4.9")).toBeTruthy()
    expect(screen.getByText(/23 Google reviews/)).toBeTruthy()
    rerender(<GoogleSummary show="site" google={g} />)
    expect(container.innerHTML).toBe("")
    rerender(<GoogleSummary show="google" google={{ ...g, rating: null }} />)
    expect(container.innerHTML).toBe("")
  })
  it("shows buttons only for set urls", () => {
    const { rerender } = render(<GoogleSummary show="all" google={g} />)
    expect(screen.queryByText("See all on Google")).toBeNull()
    expect(screen.queryByText("Write a review")).toBeNull()
    rerender(
      <GoogleSummary
        show="all"
        google={{
          ...g,
          profileUrl: "https://g.co/p",
          writeUrl: "https://g.co/w",
        }}
      />
    )
    const a = screen.getByText("See all on Google").closest("a")!
    expect(a.getAttribute("target")).toBe("_blank")
    expect(a.getAttribute("rel")).toBe("noopener noreferrer")
    expect(
      screen.getByText("Write a review").closest("a")!.getAttribute("href")
    ).toBe("https://g.co/w")
  })
})
