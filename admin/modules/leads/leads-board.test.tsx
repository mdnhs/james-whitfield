// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { LeadsBoard } from "./leads-board"
import type { LeadRow } from "./queries"

afterEach(cleanup)

const lead = (id: string, status: string): LeadRow => ({
  id,
  name: `Person ${id}`,
  email: `${id}@example.com`,
  phone: null,
  topicSlug: "anxiety",
  formatSlug: null,
  status,
  spamReason: null,
  assignee: null,
  createdAt: "2026-10-01T09:00:00.000Z",
})

function renderBoard(roles: MePayload["roles"]) {
  const me: MePayload = {
    user: { id: "u1", email: "a@example.com", name: "A" },
    roles,
    permissions: {},
    twoFactorEnabled: false,
    impersonatedBy: null,
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminActorProvider value={me}>
        <LeadsBoard
          leads={[lead("a", "new"), lead("b", "contacted")]}
          totals={{ new: 40, contacted: 1, booked: 0, closed: 3 }}
          onOpen={() => {}}
        />
      </AdminActorProvider>
    </QueryClientProvider>
  )
}

it("counts from server totals and links to the table when a column is cut short", () => {
  renderBoard(["intake"])
  const col = screen.getByRole("list", { name: "New" }).parentElement!
  expect(within(col).getByText("40")).toBeTruthy()
  expect(within(col).getByText(/Showing 1 of 40/)).toBeTruthy()
  expect(
    within(col)
      .getByRole("link", { name: "open table view" })
      .getAttribute("href")
  ).toBe("/admin/leads?view=table&status=new")
  const full = screen.getByRole("list", { name: "Contacted" }).parentElement!
  expect(within(full).queryByText(/Showing/)).toBeNull()
})

it("offers no drag handle without lead.update", () => {
  renderBoard(["viewer"])
  expect(screen.queryByRole("button", { name: /^Move / })).toBeNull()
  cleanup()
  renderBoard(["intake"])
  expect(screen.getAllByRole("button", { name: /^Move / }).length).toBe(2)
})
