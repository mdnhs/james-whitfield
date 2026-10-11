// server/modules/ai/service.ts
import "server-only"

import { generateText } from "ai"
import { eq } from "drizzle-orm"

import {
  baseUrlProblem,
  GATED_ROLES,
  normaliseBaseUrl,
  PROVIDER_LABELS,
  type AiSettingsUpdate,
  type ListModelsInput,
} from "@/lib/ai/schema"
import { hasPermission } from "@/lib/auth/permissions"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { conflictError, topLevelDiff } from "@/server/lib/conflict"
import {
  encryptSecret,
  SecretKeyInvalidError,
  SecretKeyMissingError,
  secretsAvailable,
} from "@/server/lib/secrets"

import { providerMessage } from "./errors"
import { listModels } from "./models"
import { getModel, localHttpAllowed, mockEnabled } from "./provider"
import {
  AI_KEY_PURPOSE,
  AI_SETTINGS_KEY,
  AiStored,
  decryptApiKey,
  isConfigured,
  parseAiSettings,
  readAiSettings,
  roleAllowed,
} from "./settings"

const NO_KEY_MESSAGE =
  "The server has no APP_ENCRYPTION_KEY, so the key can't be stored safely. Ask your developer to set it."
const fields = (fieldErrors: Record<string, string[]>) =>
  new ApiError("VALIDATION_FAILED", "Check the highlighted fields", fieldErrors)

export async function getAiStatus(actor: Actor) {
  const { value } = await readAiSettings()
  const canManage = hasPermission(actor.roles, { ai: ["manage"] })
  const available =
    value.enabled && isConfigured(value) && roleAllowed(value, actor.roles)
  // Provider and model are shown only to those who can use or manage it.
  const visible = available || canManage
  return {
    available,
    canManage,
    provider: visible ? value.provider : null,
    model: visible ? value.model : null,
    freeTierWarning: visible && value.provider === "google",
  }
}
export type AiStatus = Awaited<ReturnType<typeof getAiStatus>>

export async function getAiAdmin() {
  const { row, value } = await readAiSettings()
  const { apiKeyEncrypted, apiKeyHint, ...rest } = value
  return {
    version: row?.version ?? 0,
    value: rest,
    // Write-only (Ruling R3): whether one is stored and its last 4 only.
    apiKey: {
      hasKey: apiKeyEncrypted !== null,
      last4: apiKeyHint,
      readable: apiKeyEncrypted === null ? null : decryptApiKey(value) !== null,
    },
    keyAvailable: secretsAvailable(),
    localHttpAllowed: localHttpAllowed(),
    mock: mockEnabled(),
  }
}
export type AiAdmin = Awaited<ReturnType<typeof getAiAdmin>>

const redact = (v: AiStored) => ({
  ...v,
  apiKeyEncrypted: undefined,
  apiKeyHint: undefined,
})

export async function saveAiSettings(actor: Actor, input: AiSettingsUpdate) {
  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(settings)
      .where(eq(settings.key, AI_SETTINGS_KEY))
      .limit(1)
      .for("update")
    if ((before?.version ?? 0) !== input.version) {
      throw await conflictError(tx, {
        version: before?.version ?? 0,
        updatedAt: before?.updatedAt ?? null,
        updatedBy: before?.updatedBy ?? null,
      })
    }
    const current = parseAiSettings(before?.value)
    const oac = input.provider === "openai-compatible"
    const baseUrl = oac ? normaliseBaseUrl(input.baseUrl) : ""
    if (oac) {
      const problem = input.baseUrl
        ? baseUrlProblem(input.baseUrl, localHttpAllowed())
        : "Enter the provider's base URL"
      if (problem) throw fields({ baseUrl: [problem] })
    }

    // Ruling R3: a key never follows a different provider or host.
    let apiKeyEncrypted = current.apiKeyEncrypted
    let apiKeyHint = current.apiKeyHint
    const moved =
      input.provider !== current.provider || baseUrl !== current.baseUrl
    if (input.apiKey === null || (moved && input.apiKey === undefined)) {
      apiKeyEncrypted = null
      apiKeyHint = null
    } else if (typeof input.apiKey === "string") {
      if (!secretsAvailable()) throw fields({ apiKey: [NO_KEY_MESSAGE] })
      try {
        apiKeyEncrypted = encryptSecret(input.apiKey, AI_KEY_PURPOSE)
      } catch (error) {
        if (
          error instanceof SecretKeyMissingError ||
          error instanceof SecretKeyInvalidError
        )
          throw fields({ apiKey: [NO_KEY_MESSAGE] })
        throw error
      }
      apiKeyHint = input.apiKey.slice(-4)
    }

    if (input.enabled) {
      if (!oac && !apiKeyEncrypted)
        throw fields(
          moved
            ? {
                apiKey: [
                  `Enter the API key for ${PROVIDER_LABELS[input.provider]}`,
                ],
              }
            : { enabled: ["Add an API key before turning the assistant on"] }
        )
    }

    let share = current.shareEnquiryDetails
    let shareAudit: string | null = null
    const wanted = input.shareEnquiryDetails
    if (wanted && wanted.enabled !== current.shareEnquiryDetails.enabled) {
      if (!actor.roles.includes("owner"))
        throw new ApiError(
          "FORBIDDEN",
          "Only an owner can change enquiry sharing"
        )
      if (wanted.enabled && wanted.acknowledge !== true)
        throw fields({
          "shareEnquiryDetails.acknowledge": [
            "Confirm the acknowledgement first",
          ],
        })
      share = wanted.enabled
        ? {
            enabled: true,
            acknowledgedAt: new Date().toISOString(),
            acknowledgedBy: actor.email,
          }
        : { enabled: false, acknowledgedAt: null, acknowledgedBy: null }
      shareAudit = wanted.enabled
        ? "Let the AI assistant read enquiry details and acknowledged the privacy notice"
        : "Stopped the AI assistant reading enquiry details"
    }

    const parsed = AiStored.safeParse({
      enabled: input.enabled,
      provider: input.provider,
      model: input.model,
      baseUrl,
      apiKeyEncrypted,
      apiKeyHint,
      // Ruling R4: managers are implicit, so only gated roles are stored.
      allowedRoles: input.allowedRoles.filter((r) => GATED_ROLES.includes(r)),
      shareEnquiryDetails: share,
      systemPrompt: input.systemPrompt,
      maxOutputTokens: input.maxOutputTokens,
    })
    if (!parsed.success) throw invalid(parsed.error)
    const value = parsed.data

    // No revision (Ruling R2): a snapshot would hold the ciphertext.
    if (before) {
      await tx
        .update(settings)
        .set({
          value,
          version: before.version + 1,
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(eq(settings.key, AI_SETTINGS_KEY))
    } else {
      await tx.insert(settings).values({
        key: AI_SETTINGS_KEY,
        value,
        version: 1,
        updatedBy: actor.userId,
      })
    }

    const diff = topLevelDiff(redact(current), redact(value))
    delete diff.apiKeyEncrypted
    delete diff.apiKeyHint
    if (apiKeyEncrypted !== current.apiKeyEncrypted) {
      diff.apiKey = {
        from: current.apiKeyEncrypted ? "configured" : "none",
        to: apiKeyEncrypted ? "replaced" : "removed",
      }
    }
    await audit(
      actor,
      {
        action: "ai.settings_update",
        entityType: "setting",
        entityId: AI_SETTINGS_KEY,
        summary: "Updated AI assistant settings",
        diff,
      },
      tx
    )
    if (shareAudit)
      await audit(
        actor,
        {
          action: "ai.share_enquiry_details",
          entityType: "setting",
          entityId: AI_SETTINGS_KEY,
          summary: shareAudit,
        },
        tx
      )
  })
  return getAiAdmin()
}

// Ruling R21: the typed key, or the saved one for the same provider and host.
export async function listModelsFor(actor: Actor, input: ListModelsInput) {
  const { value } = await readAiSettings()
  const oac = input.provider === "openai-compatible"
  if (oac) {
    const problem = baseUrlProblem(input.baseUrl, localHttpAllowed())
    if (problem) throw fields({ baseUrl: [problem] })
  }
  const same =
    input.provider === value.provider &&
    (!oac || normaliseBaseUrl(input.baseUrl) === value.baseUrl)
  const apiKey = input.apiKey ?? (same ? decryptApiKey(value) : null)
  if (!oac && !apiKey) throw fields({ apiKey: ["Enter the API key first"] })
  if (mockEnabled()) return { ok: true as const, models: ["mock-model"] }
  try {
    return {
      ok: true as const,
      models: await listModels({
        provider: input.provider,
        baseUrl: input.baseUrl,
        apiKey,
      }),
    }
  } catch (error) {
    return {
      ok: false as const,
      models: [] as string[],
      message: `Couldn't list models: ${providerMessage(error, [apiKey ?? ""])}. Type the model name instead.`,
    }
  }
}

export async function testConnection(actor: Actor) {
  const { value } = await readAiSettings()
  const apiKey = decryptApiKey(value)
  const model = await getModel({ ...value, apiKey })
  let result: { ok: boolean; message: string }
  try {
    await generateText({
      model,
      prompt: "Reply with the single word OK.",
      maxOutputTokens: 64,
      maxRetries: 0,
      timeout: 30_000,
    })
    result = { ok: true, message: `Connected: ${value.model} replied.` }
  } catch (error) {
    result = {
      ok: false,
      message: `The provider answered: ${providerMessage(error, [apiKey ?? ""])}`,
    }
  }
  await audit(actor, {
    action: "ai.test_connection",
    entityType: "setting",
    entityId: AI_SETTINGS_KEY,
    summary: result.ok
      ? `Tested the AI assistant (${value.provider} · ${value.model}): connected`
      : `Tested the AI assistant (${value.provider} · ${value.model}): failed`,
  })
  return result
}
