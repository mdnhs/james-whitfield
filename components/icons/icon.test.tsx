// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ICON_NAMES } from "@/lib/icons"

import { CONTENT_ICONS } from "./content-icons"
import { Icon } from "./icon"

describe("Icon", () => {
  it("has a drawing for every icon name and nothing else", () => {
    expect(Object.keys(CONTENT_ICONS).sort()).toEqual([...ICON_NAMES].sort())
  })

  it("renders at the SVG's own size and paints with currentColor", () => {
    const { container } = render(<Icon name="shield" className="text-spruce" />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("width")).toBe("14.0909")
    expect(svg.getAttribute("height")).toBe("17.6136")
    expect(svg.getAttribute("aria-hidden")).toBe("true")
    expect(svg.getAttribute("class")).toBe("text-spruce")
    expect(container.innerHTML).not.toMatch(/#002620|#1e4f50/i)
    expect(container.innerHTML).toContain("currentColor")
  })
})
