import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ draft: false, role: null as string | null }))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: state.draft }),
}))
const getSession = vi.hoisted(() => vi.fn())
vi.mock("@/server/auth/session", () => ({ getSession }))

import { isPreviewing } from "./preview"

beforeEach(() => {
  getSession.mockReset()
  getSession.mockImplementation(async () =>
    state.role
      ? {
          user: { id: "u", email: "e@x.ie", name: "E", role: state.role },
          session: { id: "s" },
        }
      : null
  )
})

// Review Focus 4: the bypass cookie alone never shows drafts.
describe("isPreviewing", () => {
  it("is off without draft mode, and never reads the session", async () => {
    Object.assign(state, { draft: false, role: "editor" })
    expect(await isPreviewing()).toBe(false)
    expect(getSession).not.toHaveBeenCalled()
  })
  it.each([
    [null, false],
    ["intake", false],
    ["viewer", true],
    ["editor", true],
  ])("in draft mode with role %s → %s", async (role, expected) => {
    Object.assign(state, { draft: true, role })
    expect(await isPreviewing()).toBe(expected)
  })
})
