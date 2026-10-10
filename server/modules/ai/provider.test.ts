// server/modules/ai/provider.test.ts
import { afterEach, describe, expect, it, vi } from "vitest"

import { resetEnvForTests } from "@/server/env"

import { buildModel, getModel, mockEnabled } from "./provider"

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvForTests()
})

const key = "test-key-0123456789"
const info = (m: unknown) => m as { provider: string; modelId: string }

describe("buildModel", () => {
  it("builds each provider's model without calling it", () => {
    const g = buildModel({
      provider: "google",
      model: "gemini-flash-latest",
      baseUrl: "",
      apiKey: key,
    })
    expect([info(g).provider, info(g).modelId]).toEqual([
      "google.generative-ai",
      "gemini-flash-latest",
    ])
    const a = buildModel({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      baseUrl: "",
      apiKey: key,
    })
    expect([info(a).provider, info(a).modelId]).toEqual([
      "anthropic.messages",
      "claude-haiku-4-5",
    ])
    const o = buildModel({
      provider: "openai-compatible",
      model: "llama",
      baseUrl: "https://api.groq.com/openai/v1/",
      apiKey: null,
    })
    expect([info(o).provider, info(o).modelId]).toEqual([
      "custom.chat",
      "llama",
    ])
  })

  it("needs a key for Google and Anthropic", () => {
    for (const provider of ["google", "anthropic"] as const)
      expect(() =>
        buildModel({ provider, model: "m", baseUrl: "", apiKey: null })
      ).toThrow(/isn't set up/)
  })

  it("refuses a bad base URL", () => {
    expect(() =>
      buildModel({
        provider: "openai-compatible",
        model: "m",
        baseUrl: "http://example.com",
        apiKey: null,
      })
    ).toThrow(/highlighted/)
  })
})

describe("the mock provider (Ruling R7)", () => {
  it("is used only when the flag is on in development", async () => {
    vi.stubEnv("AI_PROVIDER_MOCK", "1")
    resetEnvForTests()
    expect(mockEnabled()).toBe(true)
    const model = await getModel({
      provider: "google",
      model: "gemini-flash-latest",
      baseUrl: "",
      apiKey: null,
    })
    expect(info(model).provider).toBe("mock")
  })

  it("is off by default", () => {
    expect(mockEnabled()).toBe(false)
  })
})
