import { describe, expect, it } from "vitest"

import { userStatus } from "./present"

const base = {
  id: "u",
  name: "U",
  email: "u@example.com",
  roles: ["editor"] as const,
  twoFactorEnabled: false,
  banned: false,
  banReason: null,
  banExpires: null,
  invitePending: false,
  lastActiveAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  author: null,
}
const now = new Date("2026-10-10T12:00:00Z")

describe("userStatus", () => {
  it("names each state", () => {
    expect(userStatus({ ...base } as never, now)).toEqual({
      label: "Active",
      tone: "success",
    })
    expect(userStatus({ ...base, invitePending: true } as never, now)).toEqual({
      label: "Invite pending",
      tone: "info",
    })
    expect(userStatus({ ...base, banned: true } as never, now)).toEqual({
      label: "Banned",
      tone: "danger",
    })
    expect(
      userStatus(
        { ...base, banned: true, banExpires: "2026-10-20T09:00:00Z" } as never,
        now
      ).label
    ).toBe("Banned until 20 Oct 2026")
  })

  it("treats an expired ban as active", () => {
    expect(
      userStatus(
        { ...base, banned: true, banExpires: "2026-10-01T00:00:00Z" } as never,
        now
      ).label
    ).toBe("Active")
  })
})
