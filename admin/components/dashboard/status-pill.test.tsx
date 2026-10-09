// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import { StatusPill, toneForStatus } from "./status-pill"

it.each([
  ["Published", "success"],
  ["draft", "neutral"],
  ["Scheduled", "info"],
  ["In progress", "warning"],
  ["Pending", "danger"],
  ["Something else", "neutral"],
])("toneForStatus(%j) is %s", (status, tone) => {
  expect(toneForStatus(status)).toBe(tone)
})

it("pairs a soft fill with strong text", () => {
  render(<StatusPill tone="success">Published</StatusPill>)
  const pill = screen.getByText("Published")
  expect(pill.className).toContain("bg-success-soft")
  expect(pill.className).toContain("text-success")
})
