// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import { TitledSection } from "./titled-section"

// Two section stubs mounted at once, as when one route is hidden under
// <Activity> and another is shown.
it("gives each section its own heading id", () => {
  render(
    <>
      <TitledSection title="Pages">
        <p>One</p>
      </TitledSection>
      <TitledSection title="Media">
        <p>Two</p>
      </TitledSection>
    </>
  )
  const pages = screen.getByRole("region", { name: "Pages" })
  const media = screen.getByRole("region", { name: "Media" })
  const pagesId = pages.getAttribute("aria-labelledby")
  const mediaId = media.getAttribute("aria-labelledby")
  expect(pagesId).toBeTruthy()
  expect(pagesId).not.toBe(mediaId)
  expect(document.getElementById(pagesId!)?.textContent).toBe("Pages")
  expect(document.getElementById(mediaId!)?.textContent).toBe("Media")
})
