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
  more: { label: "Learn more →" },
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
  it("links each card to its service's own page, with the editor's link text", () => {
    render(<ServicesGrid id="s" content={content} services={services} />)
    const link = screen.getByRole("link", { name: "Learn more about Anxiety" })
    expect(link.getAttribute("href")).toBe("/services/anxiety")
    expect(link.textContent).toBe("Learn more →")
  })

  it("shows no link on a card whose page is not live", () => {
    render(<ServicesGrid id="s" content={content} services={services} />)
    expect(
      screen.queryByRole("link", { name: "Learn more about Mood" })
    ).toBeNull()
    expect(screen.getByRole("heading", { name: "Mood" })).toBeTruthy()
  })
})

describe("services.grid schema", () => {
  it("has only the link text; an old saved target is dropped", async () => {
    const { servicesGrid } = await import("@/blocks/services")
    const parsed = servicesGrid.schema.parse({
      eyebrow: "E",
      title: "T",
      intro: "I",
      more: { label: "Learn more →", href: "#formats" },
    })
    expect(parsed.more).toEqual({ label: "Learn more →" })
  })
})
