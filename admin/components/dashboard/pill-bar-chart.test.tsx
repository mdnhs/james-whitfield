// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { beforeAll, expect, it, vi } from "vitest"

import { PillBarChart, type PillBarDatum } from "./pill-bar-chart"

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

const WEEK: PillBarDatum[] = [
  { key: "mon", label: "Mon", current: 4, previous: 3 },
  { key: "tue", label: "Tue", current: 9, previous: 5 },
  { key: "wed", label: "Wed", current: 2, previous: 7 },
]

const chart = (data: PillBarDatum[]) =>
  render(
    <PillBarChart
      title="Enquiries this week"
      data={data}
      currentLabel="This week"
      previousLabel="Last week"
    />
  )

it("carries every day in its screen-reader table", () => {
  chart(WEEK)
  const table = screen.getByRole("table", { name: "Enquiries this week" })
  const rows = within(table).getAllByRole("row").slice(1)
  expect(rows.map((row) => row.textContent)).toEqual([
    "Mon43",
    "Tue95",
    "Wed27",
  ])
})

it("tags only the busiest day", () => {
  const { container } = chart(WEEK)
  const tags = container.querySelectorAll("svg text[font-weight='600']")
  expect([...tags].map((tag) => tag.textContent)).toEqual(["9"])
})

it("has no tag in a week of zeros, and no NaN anywhere", () => {
  const { container } = chart(
    WEEK.map((day) => ({ ...day, current: 0, previous: 0 }))
  )
  // The chart did draw (its day axis is there), so the check means something.
  expect(container.querySelector(".recharts-xAxis")).not.toBeNull()
  expect(
    container.querySelectorAll("svg text[font-weight='600']")
  ).toHaveLength(0)
  expect(container.innerHTML).not.toContain("NaN")
})

it("ends the figure with its caption", () => {
  const { container } = chart(WEEK)
  expect(container.querySelector("figure")?.lastElementChild?.tagName).toBe(
    "FIGCAPTION"
  )
})
