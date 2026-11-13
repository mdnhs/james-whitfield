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

function open(item: "new" | null = "new") {
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
})
