// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useTheme } from "next-themes"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ADMIN_THEME_STORAGE_KEY, ThemeProvider } from "./theme-provider"

// jsdom has no matchMedia; next-themes reads it for "system".
function preferDark(dark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: dark && query.includes("dark"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function Probe() {
  const { theme, resolvedTheme } = useTheme()
  return <p data-testid="probe">{`${theme}/${resolvedTheme}`}</p>
}

const html = () => document.documentElement

beforeEach(() => {
  localStorage.clear()
  html().className = ""
  preferDark(false)
})

describe("ThemeProvider", () => {
  it("defaults to the system theme", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("system/light")
    )
    expect(html().classList.contains("light")).toBe(true)
  })

  it("follows a dark system preference", async () => {
    preferDark(true)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    await waitFor(() => expect(html().classList.contains("dark")).toBe(true))
  })

  it("restores a saved choice from its own storage key", async () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "dark")
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("dark/dark")
    )
  })

  // docs/plan.md Global Constraints: no single-key hotkeys.
  it("ignores a bare 'd' keypress", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    await waitFor(() => expect(html().classList.contains("light")).toBe(true))
    await userEvent.keyboard("d")
    expect(html().classList.contains("dark")).toBe(false)
    expect(screen.getByTestId("probe").textContent).toBe("system/light")
  })
})
