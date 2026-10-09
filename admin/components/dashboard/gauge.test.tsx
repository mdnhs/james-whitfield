// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { beforeAll, expect, it, vi } from "vitest"

import type { GaugePart } from "./chart-math"
import { Gauge } from "./gauge"

beforeAll(() => {
  // Reduced motion, so the bars draw at once without waiting on animation.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  // jsdom lays nothing out; give the chart a box so Recharts draws it.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ width: 640, height: 320 })
  )
  // Recharts' ResponsiveContainer observes its box; jsdom has no observer.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

const PARTS: GaugePart[] = [
  { key: "complete", label: "Complete", value: 41, tone: "solid" },
  { key: "work", label: "Needs work", value: 30, tone: "dark" },
  { key: "missing", label: "Missing", value: 29, tone: "hatched" },
]

const gauge = (parts: GaugePart[], headlineKey?: string) =>
  render(
    <Gauge
      title="Content health"
      parts={parts}
      centerLabel="Complete"
      headlineKey={headlineKey}
    />
  )

it("headlines the first part by default and carries every part", () => {
  gauge(PARTS)
  expect(screen.getByText("41%")).toBeTruthy()
  const table = screen.getByRole("table", { name: "Content health" })
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent)
  ).toEqual(["Part", "Count"])
  const rows = within(table).getAllByRole("row").slice(1)
  expect(rows.map((row) => row.textContent)).toEqual([
    "Complete41",
    "Needs work30",
    "Missing29",
  ])
})

it("headlines the part it is given", () => {
  gauge(PARTS, "missing")
  expect(screen.getByText("29%")).toBeTruthy()
})

it("rounds the headline down, so it never reads 100% with a part missing", () => {
  gauge([
    { key: "on", label: "On", value: 199, tone: "solid" },
    { key: "off", label: "Off", value: 1, tone: "hatched" },
  ])
  expect(screen.getByText("99%")).toBeTruthy()
  expect(screen.queryByText("100%")).toBeNull()
})

it("shows — on an empty gauge, never 0% or NaN", () => {
  const { container } = gauge(PARTS.map((part) => ({ ...part, value: 0 })))
  expect(screen.getByText("—")).toBeTruthy()
  expect(screen.queryByText("0%")).toBeNull()
  expect(container.innerHTML).not.toContain("NaN")
})

it("ends the figure with its caption", () => {
  const { container } = gauge(PARTS)
  expect(container.querySelector("figure")?.lastElementChild?.tagName).toBe(
    "FIGCAPTION"
  )
})
