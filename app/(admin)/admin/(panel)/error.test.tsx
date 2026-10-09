// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import PanelError from "./error"

it("offers a retry that re-fetches the segment", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  const retry = vi.fn()
  render(
    <PanelError
      error={Object.assign(new Error("boom"), { digest: "abc123" })}
      retry={retry}
    />
  )
  expect(screen.getByRole("alert").textContent).toContain("abc123")
  await userEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(retry).toHaveBeenCalledOnce()
})
