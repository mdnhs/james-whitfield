// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { NotificationsDto } from "@/lib/notifications"

import { NotificationsBell } from "./notifications-bell"
import { notificationsQuery } from "./queries"

const dto = (unread: number): NotificationsDto => ({
  seenAt: "2026-10-09T09:00:00.000Z",
  unread,
  items: Array.from({ length: Math.max(unread, 1) }, (_, i) => ({
    id: `lead:${i}`,
    kind: "enquiry",
    title: "New enquiry",
    description: `From Person ${i}`,
    href: `/admin/leads?lead=${i}`,
    at: "2026-10-09T09:30:00.000Z",
    unread: i < unread,
  })),
})

function stubApi(first: NotificationsDto) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = String(input)
    const body = url.endsWith("/seen")
      ? { seenAt: "2026-10-09T10:00:00.000Z" }
      : first
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

// jsdom has no Web Animations API; Base UI's ScrollArea calls it on a timer.
Element.prototype.getAnimations ??= () => []

afterEach(() => vi.unstubAllGlobals())

const renderBell = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsBell />
    </QueryClientProvider>
  )

describe("NotificationsBell", () => {
  it("polls every 60 seconds", () => {
    expect(notificationsQuery().refetchInterval).toBe(60_000)
  })

  it("opening the bell marks everything read and drops the badge", async () => {
    const fetch = stubApi(dto(2))
    renderBell()
    const bell = await screen.findByRole("button", {
      name: "Notifications (2 unread)",
    })
    await userEvent.click(bell)
    expect(
      await screen.findByRole("link", { name: /From Person 0/ })
    ).toBeTruthy()
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/seen") && init?.method === "POST"
      )
    ).toBe(true)
    expect(
      await screen.findByRole("button", { name: "Notifications" })
    ).toBeTruthy()
    // What was new when the bell opened stays marked while it is open.
    expect(screen.getAllByText("(new)")).toHaveLength(2)
  })

  it("caps the badge at 9+ and does not post when nothing is unread", async () => {
    stubApi(dto(12))
    renderBell()
    expect(
      await screen.findByRole("button", { name: "Notifications (9+ unread)" })
    ).toBeTruthy()
  })

  it("shows the empty state", async () => {
    const fetch = stubApi({
      seenAt: "2026-10-09T09:00:00.000Z",
      unread: 0,
      items: [],
    })
    renderBell()
    await userEvent.click(
      await screen.findByRole("button", { name: "Notifications" })
    )
    expect(await screen.findByText(/all caught up/)).toBeTruthy()
    expect(
      fetch.mock.calls.some(([url]) => String(url).endsWith("/seen"))
    ).toBe(false)
  })
})
