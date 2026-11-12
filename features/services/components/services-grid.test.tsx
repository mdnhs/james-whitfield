// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { BlockView } from "@/blocks/media-refs"
import type { ServiceView } from "@/lib/content/types"

import { ServicesGrid } from "./services-grid"

vi.mock("@/components/icons/icon", () => ({ Icon: () => null }))

const content = {
  eyebrow: "E",
  title: "T",
  intro: "I",
  more: { label: "Learn more →", href: "#formats" },
} as BlockView<"services.grid">

const services: ServiceView[] = [
  {
    id: "1",
    slug: "anxiety",
    title: "Anxiety",
    body: "b",
    icon: "anxiety",
    pagePath: "/services/anxiety",
  },
  {
    id: "2",
    slug: "mood",
    title: "Mood",
    body: "b",
    icon: "anxiety",
    pagePath: "",
  },
]

describe("ServicesGrid", () => {
  it("links to the landing page when set, else the block link", () => {
    render(<ServicesGrid id="s" content={content} services={services} />)
    expect(
      screen
        .getByRole("link", { name: "Learn more about Anxiety" })
        .getAttribute("href")
    ).toBe("/services/anxiety")
    expect(
      screen
        .getByRole("link", { name: "Learn more about Mood" })
        .getAttribute("href")
    ).toBe("#formats")
  })
})
