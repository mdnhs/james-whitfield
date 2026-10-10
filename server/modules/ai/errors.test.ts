// server/modules/ai/errors.test.ts
import { APICallError, RetryError } from "ai"
import { describe, expect, it } from "vitest"

import {
  friendlyChatError,
  ProviderHttpError,
  providerMessage,
  sanitise,
} from "./errors"

const KEY = "AIzaSyD-very-secret-key-1234"
const callError = (statusCode: number, responseBody: string) =>
  new APICallError({
    message: "x",
    url: "https://x",
    requestBodyValues: {},
    statusCode,
    responseBody,
  })

describe("sanitise", () => {
  it("hides keys, key-shaped tokens and URLs", () => {
    const out = sanitise(
      `bad key ${KEY} at https://10.0.0.5/v1?token=abc and sk-ant-api03-ABCDEFGHIJ key=zzz`,
      [KEY]
    )
    expect(out).not.toContain(KEY)
    expect(out).not.toContain("10.0.0.5")
    expect(out).not.toContain("sk-ant")
    expect(out).not.toContain("zzz")
    expect(sanitise("x".repeat(500), []).length).toBeLessThanOrEqual(300)
  })
})

describe("providerMessage", () => {
  it("reads the provider's JSON error message", () => {
    const body = JSON.stringify({
      error: { message: `API key not valid: ${KEY}` },
    })
    expect(providerMessage(callError(400, body), [KEY])).toBe(
      "API key not valid: [hidden]"
    )
    expect(
      providerMessage(
        new ProviderHttpError(404, '{"message":"no such model"}'),
        []
      )
    ).toBe("no such model")
  })
})

describe("friendlyChatError", () => {
  it("names the free Gemini quota, and other quotas generically", () => {
    const quota = callError(429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}')
    expect(friendlyChatError(quota, "google")).toBe(
      "The free Gemini quota is used up for today — try later or switch model in settings"
    )
    expect(friendlyChatError(quota, "anthropic")).toMatch(/limit/)
  })

  it("unwraps retries and maps auth and missing models", () => {
    const retry = new RetryError({
      message: "r",
      reason: "maxRetriesExceeded",
      errors: [callError(401, "{}")],
    })
    expect(friendlyChatError(retry, "google")).toMatch(/API key was rejected/)
    expect(friendlyChatError(callError(404, "{}"), "google")).toMatch(
      /model wasn't found/
    )
    expect(friendlyChatError(new Error("socket hang up"), "google")).toMatch(
      /Couldn't reach/
    )
  })
})
