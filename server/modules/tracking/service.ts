import "server-only"

import { randomUUID } from "node:crypto"

import { desc, eq } from "drizzle-orm"

import {
  parseGlobal,
  TrackingGlobal,
  type GlobalValue,
} from "@/lib/content/globals"
import { GA4_ID, GTM_ID, PIXEL_ID, validId } from "@/lib/tracking/ids"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { auditLogs, settings } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, topLevelDiff } from "@/server/lib/conflict"
import { sendCapi, sha256 } from "@/server/lib/meta-capi"
import {
  CAPI_TOKEN_PURPOSE,
  decryptSecret,
  encryptSecret,
  SecretKeyInvalidError,
  SecretKeyMissingError,
  secretsAvailable,
} from "@/server/lib/secrets"

import type { TrackingUpdate } from "./schema"
import { readConsentSettings, readTrackingSettings } from "./settings"

export type ChannelStatus =
  | "off"
  | "ready"
  | "missing-id"
  | "needs-gtm"
  | "needs-banner"
  | "needs-pixel"
  | "no-token"
  | "no-key"
  | "unreadable-token"

const KEY = "tracking"

const NO_KEY_MESSAGE =
  "The server has no APP_ENCRYPTION_KEY, so the token can't be stored safely. Ask your developer to set it."

function readable(encrypted: string | null) {
  if (!encrypted) return null
  try {
    return decryptSecret(encrypted, CAPI_TOKEN_PURPOSE) !== null
  } catch {
    // A wrong-length key throws; the token is then unreadable, not the page.
    return false
  }
}

function channelStatus(t: GlobalValue<"tracking">, bannerOn: boolean) {
  const gtmOk = t.enabled.gtm && Boolean(validId(GTM_ID, t.gtmId))
  const pixel = validId(PIXEL_ID, t.metaPixelId)
  const tokenReadable = readable(t.capiTokenEncrypted)
  const gate = (s: ChannelStatus): ChannelStatus =>
    s === "ready" && !bannerOn ? "needs-banner" : s
  return {
    gtm: !t.enabled.gtm
      ? "off"
      : !validId(GTM_ID, t.gtmId)
        ? "missing-id"
        : gate("ready"),
    ga4: !t.enabled.ga4
      ? "off"
      : !validId(GA4_ID, t.ga4Id)
        ? "missing-id"
        : !gtmOk
          ? "needs-gtm"
          : gate("ready"),
    meta: !t.enabled.meta ? "off" : !pixel ? "missing-id" : gate("ready"),
    capi: !t.enabled.capi
      ? "off"
      : !pixel
        ? "needs-pixel"
        : !t.capiTokenEncrypted
          ? "no-token"
          : !secretsAvailable()
            ? "no-key"
            : tokenReadable === false
              ? "unreadable-token"
              : gate("ready"),
  } satisfies Record<string, ChannelStatus>
}

export async function getTrackingAdmin() {
  const [row] = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, KEY))
  const t = parseGlobal("tracking", row?.value)
  const consent = await readConsentSettings()
  const [failure] = await getDb()
    .select({ at: auditLogs.createdAt, summary: auditLogs.summary })
    .from(auditLogs)
    .where(eq(auditLogs.action, "tracking.capi_failed"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1)
  const { capiTokenEncrypted, ...value } = t
  return {
    version: row?.version ?? 0,
    value,
    // Write-only (§12.5): only whether one is stored, never any part of it.
    capiToken: {
      configured: Boolean(capiTokenEncrypted),
      readable: readable(capiTokenEncrypted),
    },
    keyAvailable: secretsAvailable(),
    status: channelStatus(t, consent.enabled),
    lastCapiFailure: failure
      ? { at: failure.at.toISOString(), summary: failure.summary }
      : null,
  }
}
export type TrackingAdmin = Awaited<ReturnType<typeof getTrackingAdmin>>

async function lockRow(db: DbLike) {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, KEY))
    .limit(1)
    .for("update")
  return row ?? null
}

const redact = (v: GlobalValue<"tracking">) => ({
  ...v,
  capiTokenEncrypted: undefined,
})

export async function saveTracking(actor: Actor, input: TrackingUpdate) {
  await getDb().transaction(async (tx) => {
    const before = await lockRow(tx)
    if ((before?.version ?? 0) !== input.version) {
      throw await conflictError(tx, {
        version: before?.version ?? 0,
        updatedAt: before?.updatedAt ?? null,
        updatedBy: before?.updatedBy ?? null,
      })
    }
    const current = parseGlobal("tracking", before?.value)

    let capiTokenEncrypted = current.capiTokenEncrypted
    if (input.capiToken === null) capiTokenEncrypted = null
    else if (typeof input.capiToken === "string") {
      const noKey = new ApiError(
        "VALIDATION_FAILED",
        "Check the highlighted fields",
        { capiToken: [NO_KEY_MESSAGE] }
      )
      if (!secretsAvailable()) throw noKey
      try {
        capiTokenEncrypted = encryptSecret(input.capiToken, CAPI_TOKEN_PURPOSE)
      } catch (error) {
        if (
          error instanceof SecretKeyMissingError ||
          error instanceof SecretKeyInvalidError
        )
          throw noKey
        throw error
      }
    }

    let enhancedMatching = current.enhancedMatching
    let matchingAudit: string | null = null
    const wanted = input.enhancedMatching
    if (wanted && wanted.enabled !== current.enhancedMatching.enabled) {
      if (!actor.roles.includes("owner"))
        throw new ApiError(
          "FORBIDDEN",
          "Only an owner can change enhanced matching"
        )
      if (wanted.enabled) {
        if (wanted.acknowledge !== true)
          throw new ApiError(
            "VALIDATION_FAILED",
            "Check the highlighted fields",
            {
              "enhancedMatching.acknowledge": [
                "Confirm the legal acknowledgement first",
              ],
            }
          )
        enhancedMatching = {
          enabled: true,
          acknowledgedAt: new Date().toISOString(),
          acknowledgedBy: actor.email,
        }
        matchingAudit =
          "Turned on enhanced matching and acknowledged the legal basis"
      } else {
        enhancedMatching = {
          enabled: false,
          acknowledgedAt: null,
          acknowledgedBy: null,
        }
        matchingAudit = "Turned off enhanced matching"
      }
    }

    const parsed = TrackingGlobal.safeParse({
      ...input.value,
      capiTokenEncrypted,
      enhancedMatching,
    })
    if (!parsed.success) throw invalid(parsed.error)
    const value = parsed.data

    // No revision (Ruling R11): a snapshot would hold the ciphertext.
    if (before) {
      await tx
        .update(settings)
        .set({
          value,
          version: before.version + 1,
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(eq(settings.key, KEY))
    } else {
      await tx
        .insert(settings)
        .values({ key: KEY, value, version: 1, updatedBy: actor.userId })
    }

    const diff = topLevelDiff(redact(current), redact(value))
    delete diff.capiTokenEncrypted
    if (capiTokenEncrypted !== current.capiTokenEncrypted) {
      diff.capiToken = {
        from: current.capiTokenEncrypted ? "configured" : "none",
        to: capiTokenEncrypted ? "replaced" : "removed",
      }
    }
    await audit(
      actor,
      {
        action: "tracking.update",
        entityType: "setting",
        entityId: KEY,
        summary: "Updated tracking settings",
        diff,
      },
      tx
    )
    if (matchingAudit)
      await audit(
        actor,
        {
          action: "tracking.enhanced_matching",
          entityType: "setting",
          entityId: KEY,
          summary: matchingAudit,
        },
        tx
      )
  })
  invalidate([tags.setting(KEY)])
  return getTrackingAdmin()
}

export async function sendTestEvent(actor: Actor) {
  const t = await readTrackingSettings()
  const pixelId = validId(PIXEL_ID, t.metaPixelId)
  let token: string | null = null
  try {
    token = t.capiTokenEncrypted
      ? decryptSecret(t.capiTokenEncrypted, CAPI_TOKEN_PURPOSE)
      : null
  } catch {
    token = null
  }
  const fieldErrors: Record<string, string[]> = {}
  if (!pixelId) fieldErrors.metaPixelId = ["Add the Pixel ID first"]
  if (!token) fieldErrors.capiToken = ["Add a readable access token first"]
  if (!t.testEventCode)
    fieldErrors.testEventCode = [
      "Add the test event code from Events Manager first",
    ]
  if (Object.keys(fieldErrors).length)
    throw new ApiError(
      "VALIDATION_FAILED",
      "Check the highlighted fields",
      fieldErrors
    )
  // A neutral PageView: Meta processes test events too (brief §12.5).
  const result = await sendCapi({
    pixelId: pixelId!,
    token: token!,
    testEventCode: t.testEventCode,
    delays: [0],
    events: [
      {
        event_name: "PageView",
        event_time: Math.floor(Date.now() / 1000),
        event_id: randomUUID(),
        action_source: "website",
        event_source_url: `${getEnv().SITE_URL}/`,
        user_data: {
          client_user_agent: "admin-test-event",
          external_id: [sha256("admin-test-event")],
        },
      },
    ],
  })
  await audit(actor, {
    action: "tracking.test_event",
    entityType: "setting",
    entityId: KEY,
    summary: result.ok
      ? "Sent a CAPI test event"
      : `CAPI test event failed (${result.status})`,
  })
  return result.ok
    ? {
        ok: true,
        status: result.status,
        message: "Meta received the test event",
      }
    : { ok: false, status: result.status, message: result.message }
}
