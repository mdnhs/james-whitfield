import { afterEach, describe, expect, it, vi } from "vitest"

import { deliverResetEmail, isInviteLink } from "./email"

const link = (callback: string) =>
  `http://localhost:3000/api/auth/reset-password/tok123?callbackURL=${encodeURIComponent(callback)}`

describe("isInviteLink", () => {
  it.each([
    ["/admin/reset-password?invite=1", true],
    ["/admin/reset-password?a=b&invite=1", true],
    ["https://admin.example.ie/reset-password?invite=1", true],
    ["/admin/reset-password", false],
    ["/admin/reset-password?invite=10", false],
    ["/admin/reset-password?noinvite=1", false],
    ["/admin/reset-password?invite=0", false],
    ["/admin/reset-password?x=invite%3D1", false],
  ])("%s -> %s", (callback, expected) => {
    expect(isInviteLink(link(callback))).toBe(expected)
  })

  it("is false without a callbackURL or for garbage", () => {
    expect(
      isInviteLink("http://localhost:3000/api/auth/reset-password/t")
    ).toBe(false)
    expect(isInviteLink("not a url?invite=1")).toBe(false)
  })

  it("ignores invite=1 outside the callbackURL param", () => {
    expect(isInviteLink(`${link("/admin/reset-password")}&invite=1`)).toBe(
      false
    )
  })
})

describe("deliverResetEmail", () => {
  const user = { name: "Ed", email: "ed@example.com" }
  afterEach(() => vi.restoreAllMocks())

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it("sends the invite template for invite links", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    deliverResetEmail(user, link("/admin/reset-password?invite=1"), send)
    await flush()
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "ed@example.com",
      subject: expect.stringMatching(/invited/i),
    })
  })

  it("sends the reset template otherwise", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    deliverResetEmail(user, link("/admin/reset-password?invite=10"), send)
    await flush()
    expect(send.mock.calls[0][0].subject).not.toMatch(/invited/i)
    expect(send.mock.calls[0][0].subject).toMatch(/reset/i)
  })

  it("never throws, whether the send throws synchronously or rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() =>
      deliverResetEmail(user, link("/x"), () => {
        throw new Error("sync")
      })
    ).not.toThrow()
    expect(() =>
      deliverResetEmail(user, link("/x"), () =>
        Promise.reject(new Error("async"))
      )
    ).not.toThrow()
    await flush()
    expect(error).toHaveBeenCalledTimes(2)
  })
})
