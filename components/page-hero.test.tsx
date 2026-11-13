// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { BlockView } from "@/blocks/media-refs"
import type { MediaAsset } from "@/lib/media"

import { PageHero } from "./page-hero"

const image: MediaAsset = {
  id: "m1",
  src: "/images/contact/contact-hero.png",
  width: 1600,
  height: 900,
  blurDataURL: "data:image/webp;base64,AAAA",
  alt: "",
  focal: { x: 0.5, y: 0.5 },
}
const base = {
  title: "Anxiety",
  subtitle: "Calm, practical help.",
  image,
  focal: null,
  tint: 0.3,
  mirror: false,
}

afterEach(cleanup)

describe("PageHero", () => {
  it("renders the CTA link when set", () => {
    const content = {
      ...base,
      cta: { label: "Book a discovery call", href: "/contact" },
    } as BlockView<"hero.page">
    render(<PageHero content={content} homeLabel="Home" />)
    const link = screen.getByRole("link", { name: "Book a discovery call" })
    expect(link.getAttribute("href")).toBe("/contact")
  })

  it("renders no CTA when it is null", () => {
    const content = { ...base, cta: null } as BlockView<"hero.page">
    render(<PageHero content={content} homeLabel="Home" />)
    // Only the breadcrumb's home link.
    expect(screen.getAllByRole("link")).toHaveLength(1)
  })
})
