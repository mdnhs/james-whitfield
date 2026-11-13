// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { BlockView } from "@/blocks/media-refs"

import { ServiceIntroSection } from "./service-intro-section"

const content: BlockView<"service.intro"> = {
  eyebrow: "What it is",
  title: "Hypnotherapy for anxiety",
  body: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "First paragraph." }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Second " },
          { type: "text", text: "paragraph.", marks: [{ type: "bold" }] },
        ],
      },
    ],
  },
  forYouHeading: "This is for you if",
  forYou: ["You overthink at night", "You avoid busy places", "You want tools"],
}

describe("ServiceIntroSection", () => {
  it("renders the heading, body paragraphs and every for-you item", () => {
    render(<ServiceIntroSection id="about" content={content} />)
    const heading = screen.getByRole("heading", { level: 2 })
    expect(heading.textContent).toBe(content.title)
    expect(heading.id).toBe("about-heading")
    expect(screen.getByText("First paragraph.")).toBeTruthy()
    // Rich text from the editor: marks render too.
    expect(screen.getByText("paragraph.").tagName).toBe("STRONG")
    expect(
      screen.getByRole("heading", { level: 3, name: content.forYouHeading })
    ).toBeTruthy()
    const items = screen.getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toEqual(content.forYou)
  })
})
