// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { getQueryClient } from "@/admin/lib/query-client"
import { isSigningOut, registerSignOutFlush } from "@/admin/lib/sign-out-guard"

import { useSignOut } from "./use-sign-out"

const signOut = vi.fn()
vi.mock("@/admin/lib/auth-client", () => ({
  authClient: { signOut: () => signOut() },
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const assign = vi.fn()
const original = window.location

beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...original, assign },
  })
  getQueryClient().setQueryData(["dashboard"], { owner: "secret" })
})
afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: original,
  })
  vi.clearAllMocks()
  getQueryClient().clear()
})

it("drops the cache and reloads to sign-in once signed out", async () => {
  signOut.mockResolvedValue({ error: null })
  const { result } = renderHook(() => useSignOut())
  await act(() => result.current.signOut())
  expect(getQueryClient().getQueryData(["dashboard"])).toBeUndefined()
  expect(assign).toHaveBeenCalledWith("/admin/sign-in")
})

it("keeps the session's screen as it was when sign-out fails", async () => {
  signOut.mockResolvedValue({ error: { message: "nope" } })
  const { result } = renderHook(() => useSignOut())
  await act(() => result.current.signOut())
  expect(getQueryClient().getQueryData(["dashboard"])).toEqual({
    owner: "secret",
  })
  expect(assign).not.toHaveBeenCalled()
  expect(result.current.pending).toBe(false)
})

it("asks before signing out over an unsaved draft", async () => {
  const unregister = registerSignOutFlush(async () => false)
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const { result } = renderHook(() => useSignOut())
  await act(() => result.current.signOut())
  expect(confirm).toHaveBeenCalled()
  expect(signOut).not.toHaveBeenCalled()
  expect(isSigningOut()).toBe(false)
  expect(result.current.pending).toBe(false)
  unregister()
})
