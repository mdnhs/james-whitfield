// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const setTheme = vi.hoisted(() => vi.fn())
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme }) }))

import { DefaultMode } from "./default-mode"

const KEY = "mk-admin-theme"
const MARK = "mk-admin-theme-auto"

beforeEach(() => {
  localStorage.clear()
  setTheme.mockClear()
})
afterEach(cleanup)

it("applies the published mode on a first visit and records the marker", () => {
  render(<DefaultMode mode="dark" />)
  expect(setTheme).toHaveBeenCalledWith("dark")
  expect(localStorage.getItem(MARK)).toBe("dark")
})

it("follows a changed published mode when the stored theme is the marker", () => {
  localStorage.setItem(KEY, "dark")
  localStorage.setItem(MARK, "dark")
  render(<DefaultMode mode="light" />)
  expect(setTheme).toHaveBeenCalledWith("light")
  expect(localStorage.getItem(MARK)).toBe("light")
})

it("applies system and records it", () => {
  localStorage.setItem(KEY, "dark")
  localStorage.setItem(MARK, "dark")
  render(<DefaultMode mode="system" />)
  expect(setTheme).toHaveBeenCalledWith("system")
  expect(localStorage.getItem(MARK)).toBe("system")
})

it("never overrides a theme the user chose", () => {
  localStorage.setItem(KEY, "light")
  localStorage.setItem(MARK, "dark")
  render(<DefaultMode mode="dark" />)
  expect(setTheme).not.toHaveBeenCalled()
  expect(localStorage.getItem(MARK)).toBeNull()
})

it("treats a stored theme with no marker as a user choice", () => {
  localStorage.setItem(KEY, "dark")
  render(<DefaultMode mode="light" />)
  expect(setTheme).not.toHaveBeenCalled()
})
