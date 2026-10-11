import * as z from "zod"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"

// Isomorphic: the settings screen and the API validate with the same rules
// (docs/superpowers/specs/2026-10-11-ai-assistant-design.md §4).
export const AI_PROVIDERS = [
  "google",
  "anthropic",
  "openai-compatible",
] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  google: "Google Gemini",
  anthropic: "Anthropic Claude",
  "openai-compatible": "OpenAI-compatible",
}

// Suggestions the form fills in when the provider changes.
export const DEFAULT_MODEL: Record<AiProvider, string> = {
  google: "gemini-flash-lite-latest",
  anthropic: "claude-haiku-4-5",
  "openai-compatible": "",
}

// Ruling R4: managers always keep the assistant; the setting gates the rest.
export const MANAGER_ROLES = [
  "owner",
  "admin",
] as const satisfies readonly RoleName[]
export const GATED_ROLES: RoleName[] = ROLE_NAMES.filter(
  (role) => !(MANAGER_ROLES as readonly RoleName[]).includes(role)
)

export const MAX_INPUT_CHARS = 8000
export const OUTPUT_TOKENS = { min: 64, max: 8192, default: 1024 } as const

export const GEMINI_FREE_TIER_WARNING =
  "On Gemini's free tier Google may use prompts to improve its products. Don't paste client details."

export const ModelId = z
  .string()
  .trim()
  .min(1, "Enter a model name")
  .max(100)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/,
    "Use the model's ID, like gemini-flash-lite-latest"
  )

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])
const PRIVATE_V4 = [
  /^0\./,
  /^192\.0\.0\./,
  /^198\.1[89]\./,
  /^(22[4-9]|2[3-5]\d)\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
]

// Ruling R6. `allowLocalHttp` is true only when SITE_ENV is development.
export function baseUrlProblem(
  raw: string,
  allowLocalHttp: boolean
): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return "Enter the full address, like https://api.groq.com/openai/v1"
  }
  if (url.username || url.password)
    return "Remove the user name and password from the address"
  if (url.search || url.hash) return "Remove the ? or # part from the address"
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  const local = LOCAL_HOSTS.has(host)
  if (url.protocol === "http:") {
    return allowLocalHttp && local
      ? null
      : "Use an https:// address. Plain http is only allowed for localhost in development."
  }
  if (url.protocol !== "https:") return "Use an https:// address"
  if (allowLocalHttp) return null
  const internal =
    local ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("[") ||
    PRIVATE_V4.some((range) => range.test(host))
  return internal ? "Use the provider's public address" : null
}

// For "did the base URL change?" (Ruling R3) and for the provider factory.
export function normaliseBaseUrl(raw: string): string {
  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed)
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "")
  } catch {
    return trimmed.replace(/\/+$/, "")
  }
}

const unique = (values: readonly string[]) =>
  new Set(values).size === values.length

const ApiKey = z
  .string()
  .trim()
  .min(8, "API keys are longer than this")
  .max(400)

export const AiSettingsUpdate = z.object({
  version: z.number().int().min(0),
  enabled: z.boolean(),
  provider: z.enum(AI_PROVIDERS),
  model: ModelId,
  baseUrl: z.string().trim().max(300).default(""),
  // Omitted: keep. null: remove. A string: replace (write-only, Ruling R3).
  apiKey: ApiKey.nullable().optional(),
  allowedRoles: z
    .array(z.enum(ROLE_NAMES as [RoleName, ...RoleName[]]))
    .max(ROLE_NAMES.length)
    .refine(unique, "Each role once"),
  shareEnquiryDetails: z
    .object({ enabled: z.boolean(), acknowledge: z.boolean().optional() })
    .optional(),
  systemPrompt: z.string().trim().max(2000).default(""),
  maxOutputTokens: z
    .number()
    .int()
    .min(OUTPUT_TOKENS.min)
    .max(OUTPUT_TOKENS.max),
})
export type AiSettingsUpdate = z.infer<typeof AiSettingsUpdate>

export const ListModelsInput = z.object({
  provider: z.enum(AI_PROVIDERS),
  baseUrl: z.string().trim().max(300).default(""),
  apiKey: ApiKey.optional(),
})
export type ListModelsInput = z.infer<typeof ListModelsInput>

// Ruling R8: the browser sends the new text only; history is the server's.
export const ChatInput = z.object({
  conversationId: z.uuid().nullable().optional(),
  text: z.string().trim().min(1, "Type a message").max(MAX_INPUT_CHARS),
})
export type ChatInput = z.infer<typeof ChatInput>

export const ConversationParam = z.object({ id: z.uuid() })
