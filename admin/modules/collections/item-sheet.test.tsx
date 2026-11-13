// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/admin/lib/api", () => ({
  collectionsApi: {},
  parseResponse: (p: Promise<unknown>) => p,
}))

import { ItemSheet } from "./item-sheet"

type Item = Parameters<typeof ItemSheet>[0]["item"]

function open(item: Item = "new") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ItemSheet
        name="services"
        item={item}
        onClose={() => {}}
        onSaved={async () => {}}
      />
    </QueryClientProvider>
  )
}

describe("ItemSheet slug", () => {
  it("fills a new service's slug from its title", async () => {
    open()
    await userEvent.type(screen.getByLabelText("Title"), "Sleep & Rest")
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe(
      "sleep-rest"
    )
  })

  it("stops following the title once the slug is edited", async () => {
    open()
    const slug = screen.getByLabelText("Slug") as HTMLInputElement
    await userEvent.type(screen.getByLabelText("Title"), "Sleep")
    await userEvent.clear(slug)
    await userEvent.type(slug, "rest-well")
    await userEvent.type(screen.getByLabelText("Title"), " better")
    expect(slug.value).toBe("rest-well")
  })

  it("puts Title before Slug", () => {
    open()
    const labels = [...document.querySelectorAll("label")].map((l) =>
      l.textContent?.trim()
    )
    expect(labels.indexOf("Title")).toBeLessThan(labels.indexOf("Slug"))
  })

  const existing = (slug: string) =>
    ({
      id: "s1",
      sort: 0,
      version: 1,
      updatedAt: "2026-11-13T00:00:00.000Z",
      title: "Sleep",
      usedOn: [],
      values: {
        slug,
        title: "Sleep",
        body: "Rest.",
        icon: "mind",
        isVisible: true,
      },
    }) as unknown as Item

  it("keeps an untouched slug following the title when editing", async () => {
    open(existing("sleep"))
    const title = screen.getByLabelText("Title")
    await userEvent.clear(title)
    await userEvent.type(title, "Sleep & Rest")
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe(
      "sleep-rest"
    )
  })

  it("leaves a hand-picked slug alone when the title changes", async () => {
    open(existing("better-nights"))
    await userEvent.type(screen.getByLabelText("Title"), " well")
    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe(
      "better-nights"
    )
  })
})
