// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import { KpiCard } from "./kpi-card"

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

it("renders the hero KPI with its delta and arrow chip", () => {
  render(
    <KpiCard
      variant="hero"
      label="New enquiries"
      value="24"
      delta={{ label: "+3.4%", direction: "up" }}
      caption="vs last month"
      href="/admin/leads"
    />
  )
  const card = screen.getByRole("article")
  expect(card.dataset.variant).toBe("hero")
  expect(screen.getByRole("heading", { name: "New enquiries" })).toBeTruthy()
  expect(card.textContent).toContain("+3.4% vs last month")
  expect(
    screen
      .getByRole("link", { name: "Open New enquiries" })
      .getAttribute("href")
  ).toBe("/admin/leads")
})

it("renders without a chip or delta", () => {
  render(<KpiCard label="Subscribers" value="312" caption="All time" />)
  expect(screen.queryByRole("link")).toBeNull()
  expect(screen.getByRole("article").dataset.variant).toBe("default")
})
