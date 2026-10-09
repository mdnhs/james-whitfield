import { describe, expect, it, vi } from "vitest"

import { ROLE_NAMES } from "@/lib/auth/permissions"
import { reachableLinks } from "@/lib/admin/nav"

import { buildActions, matchesQuery } from "./actions"

// Review Focus #3. Actions are the same for everyone and none navigates to a
// gated page, so the only role-dependent list is the server's "Go to".
describe.each(ROLE_NAMES)("palette actions for %s", (role) => {
  const actions = buildActions({
    setTheme: vi.fn(),
    signOut: vi.fn(),
    siteUrl: "https://example.com",
  })
  const visible = (q: string) =>
    actions.filter((a) => matchesQuery(q, a.label, a.keywords))

  it("offers the same fixed action set", () => {
    expect(visible("").map((a) => a.id)).toEqual([
      "theme-light",
      "theme-dark",
      "theme-system",
      "open-site",
      "sign-out",
    ])
  })

  it("never matches a gated page by its name", () => {
    const gated = reachableLinks([role]).map((l) => l.label)
    const blocked = ["Users & roles", "Custom code", "Design system"].filter(
      (label) => !gated.includes(label)
    )
    for (const label of blocked) expect(visible(label)).toEqual([])
  })
})
