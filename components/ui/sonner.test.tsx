// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { beforeEach, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"

import { Toaster } from "./sonner"

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

it("renders toasts in the admin's current theme", async () => {
  render(
    <ThemeProvider defaultTheme="dark">
      <Toaster />
    </ThemeProvider>
  )
  act(() => {
    toast("Saved")
  })
  await waitFor(() =>
    expect(
      document
        .querySelector("[data-sonner-toaster]")
        ?.getAttribute("data-sonner-theme")
    ).toBe("dark")
  )
})
