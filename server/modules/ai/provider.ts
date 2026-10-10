// server/modules/ai/provider.ts
import "server-only"

import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogle } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"

import {
  baseUrlProblem,
  normaliseBaseUrl,
  type AiProvider,
} from "@/lib/ai/schema"
import { ApiError } from "@/server/api/errors"
import { getEnv } from "@/server/env"

export type ModelSettings = {
  provider: AiProvider
  model: string
  baseUrl: string
  apiKey: string | null
}

// Ruling R7: SITE_ENV, not NODE_ENV (E2E runs `next start`).
export const mockEnabled = () => {
  const env = getEnv()
  return env.AI_PROVIDER_MOCK && env.SITE_ENV === "development"
}
export const localHttpAllowed = () => getEnv().SITE_ENV === "development"

const notSetUp = () =>
  new ApiError(
    "UNAVAILABLE",
    "The AI assistant isn't set up yet. An owner or admin can add an API key in AI assistant settings."
  )

// Building a model makes no network call; the first request does.
export function buildModel(s: ModelSettings): LanguageModel {
  switch (s.provider) {
    case "google":
      if (!s.apiKey) throw notSetUp()
      return createGoogle({ apiKey: s.apiKey })(s.model)
    case "anthropic":
      if (!s.apiKey) throw notSetUp()
      return createAnthropic({ apiKey: s.apiKey })(s.model)
    case "openai-compatible": {
      const problem = baseUrlProblem(s.baseUrl, localHttpAllowed())
      if (problem)
        throw new ApiError(
          "VALIDATION_FAILED",
          "Check the highlighted fields",
          { baseUrl: [problem] }
        )
      return createOpenAICompatible({
        name: "custom",
        baseURL: normaliseBaseUrl(s.baseUrl),
        apiKey: s.apiKey ?? undefined,
        includeUsage: true,
      })(s.model)
    }
  }
}

export async function getModel(s: ModelSettings): Promise<LanguageModel> {
  if (mockEnabled()) {
    const { mockModel } = await import("./mock-model")
    return mockModel(s.model || "mock-model")
  }
  return buildModel(s)
}
