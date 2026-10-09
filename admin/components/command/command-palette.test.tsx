// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { CommandPalette } from "./command-palette"
import { CommandPaletteProvider } from "./palette-context"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: vi.fn() }) }))
vi.mock("@/admin/modules/auth/use-sign-out", () => ({
  useSignOut: () => ({ signOut: vi.fn() }),
}))

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {}
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [] }), {
          headers: { "content-type": "application/json" },
        })
    )
  )
})
afterEach(() => vi.clearAllMocks())

function renderPalette() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CommandPaletteProvider>
        <CommandPalette siteUrl="https://example.com" />
      </CommandPaletteProvider>
    </QueryClientProvider>
  )
}

describe("CommandPalette", () => {
  it("clears the query when ⌘K closes it, like Escape does", async () => {
    renderPalette()
    await userEvent.keyboard("{Meta>}k{/Meta}")
    const input = await screen.findByRole("combobox")
    await userEvent.type(input, "dark")
    expect((input as HTMLInputElement).value).toBe("dark")

    await userEvent.keyboard("{Meta>}k{/Meta}")
    await userEvent.keyboard("{Meta>}k{/Meta}")
    expect(
      ((await screen.findByRole("combobox")) as HTMLInputElement).value
    ).toBe("")
  })
})
