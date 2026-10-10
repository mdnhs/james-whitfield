import { describe, expect, it } from "vitest"

import {
  AiSettingsUpdate,
  baseUrlProblem,
  ChatInput,
  normaliseBaseUrl,
} from "./schema"

describe("baseUrlProblem", () => {
  it("accepts public https addresses", () => {
    expect(baseUrlProblem("https://api.groq.com/openai/v1", false)).toBeNull()
    expect(baseUrlProblem("https://api.groq.com./openai/v1", false)).toBeNull()
    expect(baseUrlProblem("https://198.20.0.1/v1", false)).toBeNull()
    expect(baseUrlProblem("https://223.1.1.1/v1", false)).toBeNull()
    expect(baseUrlProblem("https://openrouter.ai/api/v1", false)).toBeNull()
  })

  it("allows http only for localhost in development", () => {
    expect(baseUrlProblem("http://localhost:11434/v1", true)).toBeNull()
    expect(baseUrlProblem("http://127.0.0.1:1234/v1", true)).toBeNull()
    expect(baseUrlProblem("http://localhost:11434/v1", false)).toMatch(/https/)
    expect(baseUrlProblem("http://example.com/v1", true)).toMatch(/https/)
  })

  it("refuses credentials, queries, other schemes and garbage", () => {
    expect(baseUrlProblem("https://u:p@api.example.com", false)).toMatch(
      /user name/
    )
    expect(baseUrlProblem("https://api.example.com/v1?x=1", false)).toMatch(
      /\?/
    )
    expect(baseUrlProblem("ftp://api.example.com", false)).toMatch(/https/)
    expect(baseUrlProblem("not a url", false)).toMatch(/full address/)
  })

  it("refuses private and local hosts outside development", () => {
    for (const host of [
      "https://10.0.0.5/v1",
      "https://192.168.1.2/v1",
      "https://172.20.0.1/v1",
      "https://169.254.169.254/latest",
      "https://100.64.0.1/v1",
      "https://localhost/v1",
      "https://ollama.local/v1",
      "https://[::1]/v1",
      "https://localhost./v1",
      "https://ollama.local./v1",
      "https://metadata.google.internal./v1",
      "https://10.0.0.1./v1",
      "https://192.0.0.8/v1",
      "https://198.18.0.1/v1",
      "https://198.19.255.1/v1",
      "https://224.0.0.1/v1",
      "https://240.0.0.1/v1",
      "https://255.255.255.255/v1",
    ]) {
      expect(baseUrlProblem(host, false), host).toMatch(/public address/)
    }
    expect(baseUrlProblem("https://10.0.0.5/v1", true)).toBeNull()
  })

  it("normalises trailing slashes and case for comparison", () => {
    expect(normaliseBaseUrl(" https://API.Groq.com/openai/v1/ ")).toBe(
      "https://api.groq.com/openai/v1"
    )
  })
})

const valid = {
  version: 0,
  enabled: false,
  provider: "google",
  model: "gemini-flash-latest",
  allowedRoles: ["editor", "viewer"],
  maxOutputTokens: 1024,
}

describe("AiSettingsUpdate", () => {
  it("accepts a minimal update and defaults the optional text", () => {
    expect(AiSettingsUpdate.parse(valid)).toMatchObject({
      baseUrl: "",
      systemPrompt: "",
    })
  })

  it("bounds the output cap and the extra instructions", () => {
    expect(
      AiSettingsUpdate.safeParse({ ...valid, maxOutputTokens: 8193 }).success
    ).toBe(false)
    expect(
      AiSettingsUpdate.safeParse({ ...valid, maxOutputTokens: 63 }).success
    ).toBe(false)
    expect(
      AiSettingsUpdate.safeParse({ ...valid, systemPrompt: "x".repeat(2001) })
        .success
    ).toBe(false)
  })

  it("takes model ids with slashes and colons but no spaces", () => {
    for (const model of ["meta-llama/llama-4:free", "claude-haiku-4-5"])
      expect(AiSettingsUpdate.safeParse({ ...valid, model }).success).toBe(true)
    expect(
      AiSettingsUpdate.safeParse({ ...valid, model: "two words" }).success
    ).toBe(false)
  })

  it("refuses duplicate roles and short keys", () => {
    expect(
      AiSettingsUpdate.safeParse({
        ...valid,
        allowedRoles: ["viewer", "viewer"],
      }).success
    ).toBe(false)
    expect(
      AiSettingsUpdate.safeParse({ ...valid, apiKey: "short" }).success
    ).toBe(false)
  })
})

describe("ChatInput", () => {
  it("caps the message at 8 000 characters and needs some text", () => {
    expect(ChatInput.safeParse({ text: "x".repeat(8000) }).success).toBe(true)
    expect(ChatInput.safeParse({ text: "x".repeat(8001) }).success).toBe(false)
    expect(ChatInput.safeParse({ text: "   " }).success).toBe(false)
    expect(
      ChatInput.safeParse({ text: "hi", conversationId: "nope" }).success
    ).toBe(false)
  })
})
