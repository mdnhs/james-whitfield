// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import { ActivityFeed } from "./activity-feed"

const now = Date.parse("2026-10-09T10:00:00Z")

it("lists entries with avatar initials, relative time and status", () => {
  render(
    <ActivityFeed
      now={now}
      emptyTitle="Nothing yet"
      emptyDescription="Activity shows here."
      entries={[
        {
          id: "1",
          name: "Niamh Walsh",
          description: "Published “Sleep and stress”",
          at: "2026-10-09T09:55:00Z",
          status: { label: "Published", tone: "success" },
        },
      ]}
    />
  )
  const items = screen.getAllByRole("listitem")
  expect(items).toHaveLength(1)
  expect(items[0].textContent).toContain("NW")
  expect(items[0].textContent).toContain("5 minutes ago")
  expect(screen.getByText("Published").dataset.tone).toBe("success")
  // Named, so it makes sense when it takes focus to scroll.
  expect(screen.getByRole("region", { name: "Recent activity" })).toBeTruthy()
})

it("shows the empty state when there is nothing", () => {
  render(
    <ActivityFeed
      now={now}
      entries={[]}
      emptyTitle="Nothing yet"
      emptyDescription="Activity shows here."
    />
  )
  expect(screen.getByText("Nothing yet")).toBeTruthy()
  expect(screen.queryByRole("listitem")).toBeNull()
})
