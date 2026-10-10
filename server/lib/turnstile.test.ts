import { afterEach, describe, expect, it, vi } from "vitest"

import { resetEnvForTests } from "@/server/env"

import {
  turnstileEnabled,
  turnstileSiteKey,
  verifyTurnstile,
} from "./turnstile"

// Cloudflare's documented test keys (always-pass site key / secret).
const KEYS = {
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
}
const reply = (body: object, status = 200) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  resetEnvForTests()
})

const on = () => {
  for (const [k, v] of Object.entries(KEYS)) vi.stubEnv(k, v)
  resetEnvForTests()
}

describe("turnstile config", () => {
  it("is off without keys", () => {
    expect(turnstileEnabled()).toBe(false)
    expect(turnstileSiteKey()).toBeNull()
  })
  it("is on with both keys", () => {
    on()
    expect(turnstileEnabled()).toBe(true)
    expect(turnstileSiteKey()).toBe(KEYS.TURNSTILE_SITE_KEY)
  })
})

describe("verifyTurnstile", () => {
  it("passes when success, action and hostname match", async () => {
    on()
    const spy = reply({ success: true, action: "lead", hostname: "localhost" })
    expect(await verifyTurnstile("tok", "203.0.113.1")).toBe("pass")
    const init = spy.mock.calls[0]![1]!
    const body = init.body as URLSearchParams
    expect(body.get("secret")).toBe(KEYS.TURNSTILE_SECRET_KEY)
    expect(body.get("response")).toBe("tok")
    expect(body.get("remoteip")).toBe("203.0.113.1")
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    [{ success: false, "error-codes": ["invalid-input-response"] }],
    [{ success: true, action: "login", hostname: "localhost" }],
    [{ success: true, action: "lead", hostname: "evil.example" }],
  ])("fails for an explicit answer %j", async (body) => {
    on()
    reply(body)
    expect(await verifyTurnstile("tok", null)).toBe("fail")
  })

  it("fails without a token, never calling Cloudflare", async () => {
    on()
    const spy = reply({ success: true, action: "lead", hostname: "localhost" })
    expect(await verifyTurnstile(undefined, null)).toBe("fail")
    expect(spy).not.toHaveBeenCalled()
  })

  // Ruling R17: an unreachable siteverify fails open (the caller flags the lead).
  it.each([
    ["a network error", () => Promise.reject(new TypeError("fetch failed"))],
    [
      "a timeout",
      () => Promise.reject(new DOMException("timed out", "TimeoutError")),
    ],
    [
      "a 5xx answer",
      () => Promise.resolve(new Response("bad gateway", { status: 502 })),
    ],
    [
      "Cloudflare's internal-error",
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              "error-codes": ["internal-error"],
            })
          )
        ),
    ],
  ])("is unavailable on %s", async (_label, impl) => {
    on()
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(globalThis, "fetch").mockImplementation(impl)
    expect(await verifyTurnstile("tok", null)).toBe("unavailable")
  })
})
