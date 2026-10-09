import { APIError } from "better-auth/api"
import { beforeEach, describe, expect, it, vi } from "vitest"

const createUser = vi.fn()
const requestPasswordReset = vi.fn()

vi.mock("@/server/auth/auth", () => ({
  getAuth: () => ({ api: { createUser, requestPasswordReset } }),
}))
vi.mock("@/server/db/client", () => ({
  getDb: () => ({ query: { users: { findFirst: async () => undefined } } }),
}))
vi.mock("@/server/lib/audit", () => ({ audit: vi.fn() }))

import { ApiError } from "@/server/api/errors"

import { provisionUser } from "./service"

const input = { email: "a@example.com", name: "A", role: "viewer" as const }

beforeEach(() => {
  createUser.mockReset()
  requestPasswordReset.mockReset()
})

describe("provisionUser duplicate mapping", () => {
  it("maps a Better Auth duplicate error to CONFLICT", async () => {
    createUser.mockRejectedValue(
      APIError.from("BAD_REQUEST", {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists. Use another email.",
      })
    )
    const error = await provisionUser(input, { as: "system" }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe("CONFLICT")
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it("maps a Postgres unique violation to CONFLICT", async () => {
    createUser.mockRejectedValue(
      Object.assign(new Error("x"), { cause: { code: "23505" } })
    )
    const error = await provisionUser(input, { as: "system" }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe("CONFLICT")
  })

  it("rethrows other errors", async () => {
    const boom = new Error("boom")
    createUser.mockRejectedValue(boom)
    await expect(provisionUser(input, { as: "system" })).rejects.toBe(boom)
  })
})
