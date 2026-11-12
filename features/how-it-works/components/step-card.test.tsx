// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ProcessStepView } from "@/lib/content/types"
import { StepCard } from "./step-card"

vi.mock("@/components/media-image", () => ({ MediaImage: () => null }))

const step = {
  id: "s1",
  title: "Book",
  description: "d",
  image: null,
  frame: { x: 0, y: 0, w: 1, h: 1 },
} as unknown as ProcessStepView

describe("StepCard", () => {
  it("fills the editable step tag", () => {
    render(
      <ul>
        <StepCard step={step} index={1} stepTag="Step {n}" />
      </ul>
    )
    expect(screen.getByText("Step 2")).toBeTruthy()
  })

  it("hides the tag when the copy is empty", () => {
    render(
      <ul>
        <StepCard step={step} index={1} stepTag="" />
      </ul>
    )
    expect(screen.queryByText(/Step/)).toBeNull()
  })
})
