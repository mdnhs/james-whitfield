// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import { useReducedMotion } from "./use-reduced-motion"

function prefersReduced(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

it.each([true, false])("follows prefers-reduced-motion = %s", (matches) => {
  prefersReduced(matches)
  expect(renderHook(() => useReducedMotion()).result.current).toBe(matches)
})
