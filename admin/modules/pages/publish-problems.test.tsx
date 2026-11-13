// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PublishProblems } from "./publish-problems"

describe("PublishProblems", () => {
  it("lists every problem and flags the ones a developer must fix", () => {
    render(
      <PublishProblems
        problems={[
          { text: "FAQ: Required", developer: false },
          { text: "FAQ (hidden section): Required", developer: true },
        ]}
      />
    )
    const alert = screen.getByRole("alert")
    expect(within(alert).getByText("FAQ: Required")).toBeTruthy()
    expect(
      within(alert).getByText(
        "This page has a layout problem a developer needs to fix: FAQ (hidden section): Required"
      )
    ).toBeTruthy()
  })

  it("renders nothing without problems", () => {
    const { container } = render(<PublishProblems problems={[]} />)
    expect(container.innerHTML).toBe("")
  })
})
