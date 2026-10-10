// server/modules/ai/errors.ts
import "server-only"

import { APICallError, RetryError } from "ai"

import type { AiProvider } from "@/lib/ai/schema"

// A non-2xx answer from a provider's model list (models.ts).
export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Provider answered ${status}`)
    this.name = "ProviderHttpError"
  }
}

const unwrap = (error: unknown): unknown =>
  RetryError.isInstance(error) ? unwrap(error.lastError) : error

function statusOf(error: unknown): number | undefined {
  const e = unwrap(error)
  if (APICallError.isInstance(e)) return e.statusCode
  if (e instanceof ProviderHttpError) return e.status
  return undefined
}

function bodyOf(error: unknown): string {
  const e = unwrap(error)
  if (APICallError.isInstance(e)) return e.responseBody ?? e.message
  if (e instanceof ProviderHttpError) return e.body
  return e instanceof Error ? e.message : String(e)
}

function extractMessage(body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: unknown } | string
      message?: unknown
    }
    const m =
      typeof json.error === "object"
        ? json.error?.message
        : (json.error ?? json.message)
    if (typeof m === "string" && m) return m
  } catch {
    // Not JSON: use the text as it came.
  }
  return body
}

// Provider text is shown to managers, so nothing secret or internal may
// survive: the key itself, key-shaped tokens, and any URL (Review Focus 2).
export function sanitise(text: string, secrets: readonly string[]) {
  let out = text
  for (const secret of secrets)
    if (secret.length >= 4) out = out.split(secret).join("[hidden]")
  return out
    .replace(/https?:\/\/\S+/g, "[address]")
    .replace(/\b(key|token|api[_-]?key)=\S+/gi, "$1=[hidden]")
    .replace(/\b(?:sk|AIza|gsk|xai|pk)[-_A-Za-z0-9]{8,}/g, "[hidden]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)
}

export function providerMessage(error: unknown, secrets: readonly string[]) {
  const text = sanitise(extractMessage(bodyOf(error)), secrets)
  const status = statusOf(error)
  return text || (status ? `Status ${status}` : "No details")
}

const QUOTA = /quota|RESOURCE_EXHAUSTED|rate.?limit|too many requests/i

export function friendlyChatError(error: unknown, provider: AiProvider) {
  const status = statusOf(error)
  const body = bodyOf(error)
  if (status === 429 || QUOTA.test(body)) {
    return provider === "google"
      ? "The free Gemini quota is used up for today — try later or switch model in settings"
      : "The AI provider's usage limit was reached. Try again later or switch model in settings."
  }
  if (status === 401 || status === 403)
    return "The API key was rejected. An owner or admin can check it in AI assistant settings."
  if (status === 404)
    return "That model wasn't found. An owner or admin can pick another one in AI assistant settings."
  if (status === undefined)
    return "Couldn't reach the AI provider. Try again in a moment."
  return "The AI provider couldn't answer just now. Try again in a moment."
}
