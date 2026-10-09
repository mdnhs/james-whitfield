import { describe, expect, it, vi } from "vitest"

import { buildActions, matchesQuery } from "./actions"

describe("palette actions", () => {
  const setTheme = vi.fn()
  const signOut = vi.fn()
  const actions = buildActions({
    setTheme,
    signOut,
    siteUrl: "https://example.com",
  })

  it("matches by label or keyword", () => {
    const ids = actions
      .filter((action) => matchesQuery("dark", action.label, action.keywords))
      .map((action) => action.id)
    expect(ids).toEqual(["theme-dark"])
    expect(matchesQuery("log out", "Sign out", ["log out"])).toBe(true)
    expect(matchesQuery("", "Anything", [])).toBe(true)
  })

  it("runs the theme switch", () => {
    actions.find((action) => action.id === "theme-dark")!.run()
    expect(setTheme).toHaveBeenCalledWith("dark")
  })
})
