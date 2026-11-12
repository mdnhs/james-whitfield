// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { BlockView } from "@/blocks/media-refs"

import { JourneySection } from "./journey-section"

// GSAP needs layout and matchMedia, which jsdom lacks; the markup is what's
// under test here.
vi.mock("@/lib/gsap", () => ({
  gsap: {},
  ScrollTrigger: {},
  useGSAP: vi.fn(),
}))

const content = {
  eyebrow: "How it works",
  title: "From first call to launch",
  steps: [
    { title: "Discovery", body: "We listen.", tag: "1 week" },
    { title: "Proposal", body: "We scope it.", tag: "2 days" },
    { title: "Build", body: "We ship it.", tag: "6 weeks" },
    { title: "Integration", body: "We hand over.", tag: "" },
  ],
  cta: { href: "/contact", label: "Book a call" },
} as unknown as BlockView<"journey">

describe("JourneySection", () => {
  it("renders each step once, in a single list", () => {
    const { container } = render(
      <JourneySection id="journey" content={content} />
    )

    expect(container.querySelectorAll("ol")).toHaveLength(1)
    expect(container.querySelectorAll("[data-step]")).toHaveLength(4)
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4)
    expect(screen.getAllByText("Discovery")).toHaveLength(1)
  })

  it("renders each tag once", () => {
    render(<JourneySection id="journey" content={content} />)

    expect(screen.getAllByText("1 week")).toHaveLength(1)
    expect(screen.getAllByText("6 weeks")).toHaveLength(1)
  })
})
