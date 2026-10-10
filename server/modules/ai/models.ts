// server/modules/ai/models.ts
import "server-only"

import { normaliseBaseUrl, type AiProvider } from "@/lib/ai/schema"

import { ProviderHttpError } from "./errors"

const TIMEOUT_MS = 10_000
const MAX_MODELS = 500
const MAX_BODY_BYTES = 1_000_000

// Reads at most MAX_BODY_BYTES, then cancels: the host is admin-chosen.
async function boundedText(res: Response) {
  const reader = res.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new Error("The provider's answer was too large")
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

// Ruling R6: no redirects (a base URL may not bounce us elsewhere) and a
// hard timeout. Response bodies are read only for these small JSON lists.
async function getJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>
) {
  const res = await fetchImpl(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await boundedText(res)
  if (!res.ok) throw new ProviderHttpError(res.status, text.slice(0, 2000))
  return JSON.parse(text) as unknown
}

type Listing = { data?: { id?: unknown }[]; has_more?: unknown }
type GeminiListing = {
  models?: { name?: unknown; supportedGenerationMethods?: unknown }[]
  nextPageToken?: unknown
}

export async function listModels(
  input: { provider: AiProvider; baseUrl: string; apiKey: string | null },
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<string[]> {
  const ids: string[] = []
  if (input.provider === "google") {
    let token: string | null = null
    for (let page = 0; page < 5; page++) {
      const query = token ? `&pageToken=${encodeURIComponent(token)}` : ""
      const json = (await getJson(
        fetchImpl,
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${query}`,
        { "x-goog-api-key": input.apiKey ?? "" }
      )) as GeminiListing
      for (const m of json.models ?? []) {
        const methods = Array.isArray(m.supportedGenerationMethods)
          ? m.supportedGenerationMethods
          : []
        if (typeof m.name === "string" && methods.includes("generateContent"))
          ids.push(m.name.replace(/^models\//, ""))
      }
      token = typeof json.nextPageToken === "string" ? json.nextPageToken : null
      if (!token) break
    }
  } else if (input.provider === "anthropic") {
    const json = (await getJson(
      fetchImpl,
      "https://api.anthropic.com/v1/models?limit=1000",
      {
        "x-api-key": input.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      }
    )) as Listing
    for (const m of json.data ?? [])
      if (typeof m.id === "string") ids.push(m.id)
  } else {
    const headers: Record<string, string> = input.apiKey
      ? { authorization: `Bearer ${input.apiKey}` }
      : {}
    const json = (await getJson(
      fetchImpl,
      `${normaliseBaseUrl(input.baseUrl)}/models`,
      headers
    )) as Listing
    for (const m of json.data ?? [])
      if (typeof m.id === "string") ids.push(m.id)
  }
  return [...new Set(ids)].sort().slice(0, MAX_MODELS)
}
