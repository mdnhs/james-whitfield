import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { closeDb } from "@/server/db/client"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

const COPY = {
  enabled: true,
  title: "Cookies",
  body: "Body",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  settingsLink: "Cookie settings",
}

beforeEach(resetDb)
afterAll(closeDb)

describe("consent through the globals API (Ruling R4)", () => {
  it("marketers edit it; editors, who can edit other globals, cannot", async () => {
    const marketer = await cookieFor("marketer")
    const res = await adminRequest("/globals/consent", marketer, {
      method: "PUT",
      body: { version: 0, value: COPY },
    })
    expect(res.status).toBe(200)
    expect(next.revalidateTag).toHaveBeenCalledWith("settings:consent", {
      expire: 0,
    })
    const editor = await cookieFor("editor")
    expect((await adminRequest("/globals/consent", editor)).status).toBe(403)
  })

  it("refuses to switch the banner on with missing labels", async () => {
    const res = await adminRequest(
      "/globals/consent",
      await cookieFor("admin"),
      {
        method: "PUT",
        body: { version: 0, value: { ...COPY, reject: "" } },
      }
    )
    expect(res.status).toBe(400)
  })

  it("tracking is not reachable through the generic API", async () => {
    const res = await adminRequest(
      "/globals/tracking",
      await cookieFor("owner")
    )
    expect(res.status).toBe(404)
  })
})
