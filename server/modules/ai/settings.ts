// server/modules/ai/settings.ts
import "server-only"

import { eq } from "drizzle-orm"
import * as z from "zod"

import {
  AI_PROVIDERS,
  DEFAULT_MODEL,
  GATED_ROLES,
  MANAGER_ROLES,
  OUTPUT_TOKENS,
} from "@/lib/ai/schema"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { getDb, type DbLike } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { decryptSecret } from "@/server/lib/secrets"

export const AI_SETTINGS_KEY = "ai"
export const AI_KEY_PURPOSE = "ai.apiKey"

// The stored document (Ruling R2). Never sent to the browser as is.
export const AiStored = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(AI_PROVIDERS).default("google"),
  model: z.string().max(100).default(DEFAULT_MODEL.google),
  baseUrl: z.string().max(300).default(""),
  apiKeyEncrypted: z.string().max(4000).nullable().default(null),
  apiKeyHint: z.string().max(4).nullable().default(null),
  allowedRoles: z
    .array(z.enum(ROLE_NAMES as [RoleName, ...RoleName[]]))
    .default([...GATED_ROLES]),
  shareEnquiryDetails: z
    .object({
      enabled: z.boolean().default(false),
      acknowledgedAt: z.iso.datetime().nullable().default(null),
      acknowledgedBy: z.string().max(254).nullable().default(null),
    })
    .prefault({}),
  systemPrompt: z.string().max(2000).default(""),
  maxOutputTokens: z
    .number()
    .int()
    .min(OUTPUT_TOKENS.min)
    .max(OUTPUT_TOKENS.max)
    .default(OUTPUT_TOKENS.default),
})
export type AiStored = z.infer<typeof AiStored>

export function parseAiSettings(value: unknown): AiStored {
  const parsed = AiStored.safeParse(value ?? {})
  if (parsed.success) return parsed.data
  // Writes are validated, so this is drift; defaults keep the admin up and
  // leave the assistant off until the next save heals it.
  console.warn("[ai] settings are invalid; using defaults")
  return AiStored.parse({})
}

export async function readAiSettings(db: DbLike = getDb()) {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, AI_SETTINGS_KEY))
    .limit(1)
  return { row: row ?? null, value: parseAiSettings(row?.value) }
}

export function roleAllowed(s: AiStored, roles: readonly RoleName[]) {
  return roles.some(
    (role) =>
      (MANAGER_ROLES as readonly RoleName[]).includes(role) ||
      s.allowedRoles.includes(role)
  )
}

export function decryptApiKey(s: AiStored): string | null {
  if (!s.apiKeyEncrypted) return null
  try {
    return decryptSecret(s.apiKeyEncrypted, AI_KEY_PURPOSE)
  } catch {
    // A wrong-length APP_ENCRYPTION_KEY throws; the key is then unreadable.
    return null
  }
}

// Ruling R5.
export function isConfigured(s: AiStored) {
  return s.provider === "openai-compatible"
    ? s.baseUrl !== ""
    : s.apiKeyEncrypted !== null
}
