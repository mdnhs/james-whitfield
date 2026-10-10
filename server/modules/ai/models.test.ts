// server/modules/ai/models.test.ts
import { describe, expect, it, vi } from "vitest"

import { ProviderHttpError } from "./errors"
import { listModels } from "./models"

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 })

describe("listModels", () => {
  it("lists Gemini models that can generate text, across pages", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ok({
          models: [
            {
              name: "models/gemini-flash-latest",
              supportedGenerationMethods: ["generateContent"],
            },
            {
              name: "models/text-embedding-004",
              supportedGenerationMethods: ["embedContent"],
            },
          ],
          nextPageToken: "p2",
        })
      )
      .mockResolvedValueOnce(
        ok({
          models: [
            {
              name: "models/gemini-2.5-pro",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        })
      )
    expect(
      await listModels(
        { provider: "google", baseUrl: "", apiKey: "k-0123456789" },
        fetchImpl
      )
    ).toEqual(["gemini-2.5-pro", "gemini-flash-latest"])
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
    )
    expect(new Headers(init!.headers).get("x-goog-api-key")).toBe(
      "k-0123456789"
    )
    expect(init!.redirect).toBe("error")
    expect(init!.signal).toBeInstanceOf(AbortSignal)
  })

  it("lists Anthropic and OpenAI-compatible models with their own headers", async () => {
    const a = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        ok({ data: [{ id: "claude-haiku-4-5" }], has_more: false })
      )
    expect(
      await listModels(
        { provider: "anthropic", baseUrl: "", apiKey: "k-0123456789" },
        a
      )
    ).toEqual(["claude-haiku-4-5"])
    const ah = new Headers(a.mock.calls[0]![1]!.headers)
    expect([ah.get("x-api-key"), ah.get("anthropic-version")]).toEqual([
      "k-0123456789",
      "2023-06-01",
    ])

    const o = vi
      .fn<typeof fetch>()
      .mockResolvedValue(ok({ data: [{ id: "b" }, { id: "a" }, { id: "a" }] }))
    expect(
      await listModels(
        {
          provider: "openai-compatible",
          baseUrl: "https://api.groq.com/openai/v1/",
          apiKey: "k-0123456789",
        },
        o
      )
    ).toEqual(["a", "b"])
    expect(String(o.mock.calls[0]![0])).toBe(
      "https://api.groq.com/openai/v1/models"
    )
    expect(new Headers(o.mock.calls[0]![1]!.headers).get("authorization")).toBe(
      "Bearer k-0123456789"
    )
  })

  it("throws the provider's status and body", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("nope", { status: 401 }))
    await expect(
      listModels(
        { provider: "anthropic", baseUrl: "", apiKey: "k-0123456789" },
        f
      )
    ).rejects.toBeInstanceOf(ProviderHttpError)
  })

  it("refuses to read a huge answer", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("x".repeat(1_100_000), { status: 200 }))
    await expect(
      listModels(
        { provider: "anthropic", baseUrl: "", apiKey: "k-0123456789" },
        f
      )
    ).rejects.toThrow(/too large/)
  })
})
