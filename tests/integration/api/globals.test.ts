import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb } from "@/server/db/client"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const nav = (label: string, href = "/about") => ({
  links: [{ label, href }],
  cta: { label: "Book", href: "/contact" },
})
const put = (cookie: string, key: string, version: number, value: unknown) =>
  adminRequest(`/globals/${key}`, cookie, {
    method: "PUT",
    body: { version, value },
  })

// docs/brief.md §6.4/§7.2: [GET contact, PUT navigation, PUT site].
const MATRIX: Record<RoleName, [number, number, number]> = {
  owner: [200, 200, 200],
  admin: [200, 200, 200],
  editor: [200, 200, 403],
  author: [403, 403, 403],
  marketer: [200, 403, 403],
  intake: [403, 403, 403],
  viewer: [200, 403, 403],
}

describe.each(ROLE_NAMES)("globals RBAC for %s", (role) => {
  it(`GET contact, PUT navigation, PUT site → ${MATRIX[role].join(", ")}`, async () => {
    const cookie = await cookieFor(role)
    expect((await adminRequest("/globals/contact", cookie)).status).toBe(
      MATRIX[role][0]
    )
    expect((await put(cookie, "navigation", 0, nav("About"))).status).toBe(
      MATRIX[role][1]
    )
    expect((await put(cookie, "site", 0, { name: "Magda" })).status).toBe(
      MATRIX[role][2]
    )
  })
})

describe("globals API", () => {
  it("saves, invalidates its tag, and 409s a stale version", async () => {
    const cookie = await cookieFor("editor")
    const first = await put(cookie, "navigation", 0, nav("About"))
    expect(first.status).toBe(200)
    expect((await first.json()).version).toBe(1)
    expect(expired()).toEqual(["settings:navigation"])

    const stale = await put(cookie, "navigation", 0, nav("Other"))
    expect(stale.status).toBe(409)
    expect((await stale.json()).error.details.current.version).toBe(1)
    const current = await (
      await adminRequest("/globals/navigation", cookie)
    ).json()
    expect(current.value.links[0].label).toBe("About")
  })

  it("refuses unsafe links with a field path", async () => {
    const response = await put(
      await cookieFor("editor"),
      "navigation",
      0,
      nav("X", "javascript:alert(1)")
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error.fieldErrors).toHaveProperty([
      "links.0.href",
    ])
  })

  it("keeps 20 revisions and rolls back", async () => {
    const cookie = await cookieFor("editor")
    let version = 0
    for (let i = 1; i <= 22; i++) {
      version = (
        await (
          await put(cookie, "footer", version, { blurb: `Blurb ${i}` })
        ).json()
      ).version
    }
    const { items } = await (
      await adminRequest("/globals/footer/revisions", cookie)
    ).json()
    expect(items).toHaveLength(20)
    const oldest = items.at(-1)
    expect(oldest.version).toBe(3)
    const restored = await adminRequest(
      `/globals/footer/revisions/${oldest.id}/restore`,
      cookie,
      {
        method: "POST",
        body: { version },
      }
    )
    expect(restored.status).toBe(200)
    expect((await restored.json()).value.blurb).toBe("Blurb 3")
  })

  it.each(["tracking", "consent", "scripts", "theme", "nope"])(
    "%s is not served by the generic route",
    async (key) => {
      expect(
        (await adminRequest(`/globals/${key}`, await cookieFor("owner"))).status
      ).toBe(404)
    }
  )
})
