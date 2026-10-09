// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, expect, it } from "vitest"

import { SidebarProvider, useSidebar } from "./sidebar"

beforeAll(() => {
  // jsdom has no matchMedia; a desktop width keeps the sidebar a panel.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

function State() {
  return <output>{useSidebar().state}</output>
}

function setup() {
  render(
    <SidebarProvider>
      <State />
      <input aria-label="Title" />
      <div aria-label="Body" contentEditable suppressContentEditableWarning />
    </SidebarProvider>
  )
  return () => screen.getByRole("status").textContent
}

it("toggles on ⌘B / Ctrl+B outside fields", () => {
  const state = setup()
  fireEvent.keyDown(document.body, { key: "b", ctrlKey: true })
  expect(state()).toBe("collapsed")
  fireEvent.keyDown(document.body, { key: "b", metaKey: true })
  expect(state()).toBe("expanded")
})

// ⌘B is bold in the article editor (TipTap) and belongs to fields.
it("leaves ⌘B to inputs, editors and handlers that claimed it", () => {
  const state = setup()
  fireEvent.keyDown(screen.getByLabelText("Title"), { key: "b", metaKey: true })
  fireEvent.keyDown(screen.getByLabelText("Body"), { key: "b", metaKey: true })
  const claimed = new KeyboardEvent("keydown", {
    key: "b",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  claimed.preventDefault()
  window.dispatchEvent(claimed)
  expect(state()).toBe("expanded")
})
