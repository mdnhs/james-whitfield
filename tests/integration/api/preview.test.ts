import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const draft = vi.hoisted(() => ({
  enable: vi.fn(),
  disable: vi.fn(),
  isEnabled: false,
}))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  draftMode: async () => draft,
}))

import { closeDb } from "@/server/db/client"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  draft.enable.mockReset()
  draft.disable.mockReset()
})
afterAll(closeDb)

describe("preview", () => {
  it("enables draft mode and redirects to an internal path", async () => {
    const response = await adminRequest(
      "/preview?path=/about",
      await cookieFor("viewer")
    )
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("/about")
    expect(draft.enable).toHaveBeenCalledOnce()
  })
  it("refuses roles without page.read", async () => {
    const response = await adminRequest(
      "/preview?path=/about",
      await cookieFor("intake")
    )
    expect(response.status).toBe(403)
    expect(draft.enable).not.toHaveBeenCalled()
  })
  it.each(["//evil.example", "https://evil.example", "/%5Cevil", "/a?b=1"])(
    "refuses the open-redirect target %s",
    async (target) => {
      const response = await adminRequest(
        `/preview?path=${encodeURIComponent(target)}`,
        await cookieFor("editor")
      )
      expect(response.status).toBe(400)
      expect(draft.enable).not.toHaveBeenCalled()
    }
  )
  it("needs a session", async () => {
    expect((await adminRequest("/preview?path=/", "")).status).toBe(401)
  })
  it("exits to the page, falling back to / for odd paths", async () => {
    const cookie = await cookieFor("editor")
    const exit = await adminRequest("/preview/exit?path=//evil.example", cookie)
    expect(exit.status).toBe(307)
    expect(exit.headers.get("location")).toBe("/")
    expect(draft.disable).toHaveBeenCalledOnce()
  })
})
