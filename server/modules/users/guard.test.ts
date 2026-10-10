import { describe, expect, it } from "vitest"

import { losesOwner, refusal, viewAsRefusal } from "./guard"

const owner = { userId: "o1", roles: ["owner"] as const }
const admin = { userId: "a1", roles: ["admin"] as const }
const t = (id: string, roles: string[]) =>
  ({ id, roles }) as Parameters<typeof refusal>[1]

describe("refusal", () => {
  it("refuses acting on yourself, except linking an author", () => {
    expect(refusal(owner, t("o1", ["owner"]), "set-role", ["owner"])).toBe(
      "You can't change your own role"
    )
    for (const action of [
      "ban",
      "unban",
      "revoke",
      "delete",
      "impersonate",
    ] as const)
      expect(refusal(owner, t("o1", ["owner"]), action)).toMatch(/your own/)
    expect(refusal(owner, t("o1", ["owner"]), "link-author")).toBeNull()
  })

  it("never lets an admin act on an owner, multi-role owners included", () => {
    expect(refusal(admin, t("x", ["owner"]), "ban")).toBe(
      "Only an owner can manage another owner"
    )
    expect(refusal(admin, t("x", ["editor", "owner"]), "delete")).toBe(
      "Only an owner can manage another owner"
    )
  })

  it("never lets an admin grant the owner role", () => {
    expect(
      refusal(admin, t("x", ["editor"]), "set-role", ["editor", "owner"])
    ).toBe("Only an owner can grant the owner role")
  })

  it("lets an owner act on owners and an admin on non-owners", () => {
    expect(refusal(owner, t("o2", ["owner"]), "set-role", ["admin"])).toBeNull()
    expect(
      refusal(admin, t("e", ["editor"]), "set-role", ["marketer"])
    ).toBeNull()
    expect(refusal(admin, t("a2", ["admin"]), "ban")).toBeNull()
  })
})

describe("losesOwner", () => {
  it("is true only when an owner loses the role or the account", () => {
    const o = t("o2", ["owner"])
    expect(losesOwner(o, "set-role", ["admin"])).toBe(true)
    expect(losesOwner(o, "set-role", ["owner", "editor"])).toBe(false)
    expect(losesOwner(o, "ban")).toBe(true)
    expect(losesOwner(o, "delete")).toBe(true)
    expect(losesOwner(o, "revoke")).toBe(false)
    expect(losesOwner(t("e", ["editor"]), "delete")).toBe(false)
  })
})

describe("viewAsRefusal", () => {
  it("needs impersonate, and impersonate-admins for an owner or admin", () => {
    expect(viewAsRefusal(admin, t("e", ["editor"]))).toBeNull()
    expect(viewAsRefusal(owner, t("a2", ["admin"]))).toBeNull()
    expect(viewAsRefusal(admin, t("a2", ["admin"]))).toBe(
      "You can't view as this person"
    )
    expect(viewAsRefusal(admin, t("x", ["editor", "owner"]))).toBe(
      "Only an owner can manage another owner"
    )
    const demoted = { userId: "d1", roles: ["viewer"] as const }
    expect(viewAsRefusal(demoted, t("e", ["editor"]))).toBe(
      "You can't view as this person"
    )
    expect(viewAsRefusal(owner, t("o1", ["owner"]))).toMatch(/your own/)
  })
})
