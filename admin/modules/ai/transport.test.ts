// admin/modules/ai/transport.test.ts
import { describe, expect, it } from "vitest"

import { chatErrorMessage } from "./transport"

describe("chatErrorMessage", () => {
  it("reads our error envelope, plain stream errors and network failures", () => {
    expect(
      chatErrorMessage(
        new Error(
          '{"error":{"code":"RATE_LIMITED","message":"Too many requests. Wait a moment and try again."}}'
        )
      )
    ).toBe("Too many requests. Wait a moment and try again.")
    expect(
      chatErrorMessage(
        new Error(
          "The free Gemini quota is used up for today — try later or switch model in settings"
        )
      )
    ).toMatch(/Gemini quota/)
    expect(chatErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /Couldn't reach the server/
    )
    expect(chatErrorMessage(undefined)).toBeNull()
  })
})
