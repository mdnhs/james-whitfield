// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { BlockView } from "@/blocks/media-refs"

import { ServiceBenefitsSection } from "./service-benefits-section"

vi.mock("@/components/icons/icon", () => ({ Icon: () => null }))

const item = (n: number) => ({
  icon: "evidence" as const,
  title: `Benefit ${n}`,
  body: `Body ${n}`,
})

describe("ServiceBenefitsSection", () => {
  it.each([3, 4, 6])("renders %i benefit cards", (n) => {
    const content: BlockView<"service.benefits"> = {
      eyebrow: "Benefits",
      title: "What changes",
      items: Array.from({ length: n }, (_, i) => item(i + 1)),
    }
    render(<ServiceBenefitsSection id="benefits" content={content} />)
    expect(screen.getByRole("heading", { level: 2 }).id).toBe(
      "benefits-heading"
    )
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(n)
    expect(screen.getAllByRole("listitem")).toHaveLength(n)
  })
})
