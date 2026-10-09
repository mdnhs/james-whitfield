// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/admin/lib/api-error"
import { cancelSignOut, prepareSignOut } from "@/admin/lib/sign-out-guard"

import { useAutosave } from "./use-autosave"

afterEach(() => {
  vi.useRealTimers()
  cancelSignOut()
})

const bump = async (_value: string, version: number) => ({
  version: version + 1,
})

describe("useAutosave", () => {
  it("debounces and sends the latest value with the current version", async () => {
    vi.useFakeTimers()
    const save = vi.fn(bump)
    const { result } = renderHook(() => useAutosave({ version: 1, save }))
    act(() => {
      result.current.schedule("a")
      result.current.schedule("b")
    })
    await act(() => vi.advanceTimersByTimeAsync(1200))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith("b", 1)
    act(() => result.current.schedule("c"))
    await act(() => vi.advanceTimersByTimeAsync(1200))
    expect(save).toHaveBeenLastCalledWith("c", 2)
    expect(result.current.state.status).toBe("saved")
  })

  // Review Focus 3: nothing is sent over someone else's change.
  it("stops on a conflict until the editor overwrites", async () => {
    vi.useFakeTimers()
    const conflict = new ApiError(
      "CONFLICT",
      "Changed",
      409,
      null,
      {},
      {
        current: { version: 7, updatedAt: null, updatedBy: "Eve" },
      }
    )
    const save = vi.fn(bump).mockRejectedValueOnce(conflict)
    const { result } = renderHook(() => useAutosave({ version: 1, save }))
    act(() => result.current.schedule("a"))
    await act(() => vi.advanceTimersByTimeAsync(1200))
    expect(result.current.state).toMatchObject({
      status: "conflict",
      conflict: { updatedBy: "Eve" },
    })
    act(() => result.current.schedule("b"))
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(save).toHaveBeenCalledTimes(1)
    await act(() => result.current.overwrite())
    expect(save).toHaveBeenLastCalledWith("b", 7)
    expect(result.current.state.status).toBe("saved")
  })

  it("flush reports whether everything is saved", async () => {
    const save = vi.fn(bump).mockRejectedValueOnce(new TypeError("offline"))
    const { result } = renderHook(() => useAutosave({ version: 1, save }))
    act(() => result.current.schedule("a"))
    let ok = true
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(false)
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(true)
    expect(result.current.getVersion()).toBe(2)
  })

  // <Activity> runs effect cleanups when the route hides.
  it("saves a pending edit when the route hides", async () => {
    const save = vi.fn(bump)
    const { result, unmount } = renderHook(() =>
      useAutosave({ version: 1, save })
    )
    act(() => result.current.schedule("a"))
    unmount()
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith("a", 1))
  })

  it("saves before sign-out and never after it", async () => {
    vi.useFakeTimers()
    const save = vi.fn(bump)
    const { result } = renderHook(() => useAutosave({ version: 1, save }))
    act(() => result.current.schedule("a"))
    await act(() => prepareSignOut())
    expect(save).toHaveBeenCalledExactlyOnceWith("a", 1)
    act(() => result.current.schedule("b"))
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(save).toHaveBeenCalledTimes(1)
  })
})
