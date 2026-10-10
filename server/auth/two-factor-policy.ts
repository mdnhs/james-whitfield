import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"

import { audit } from "@/server/lib/audit"

// docs/brief.md §7.4 and Ruling R11, as changed on 2026-10-11 (2FA optional
// for every role): anyone may turn their own 2FA on or off (Better Auth asks
// for the password); nobody changes it for someone else through View-as;
// every change is audited.
const PATHS = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
])

type Caller = {
  user: { id: string; email: string }
  session: {
    impersonatedBy?: string | null
    ipAddress?: string | null
    userAgent?: string | null
  }
}

const before = createAuthMiddleware(async (ctx) => {
  const session = (await getSessionFromCtx(ctx, {
    disableCookieCache: true,
  })) as Caller | null
  if (!session) return
  if (session.session.impersonatedBy) {
    throw new APIError("FORBIDDEN", {
      code: "IMPERSONATION_READ_ONLY",
      message: "Two-factor settings can't be changed while viewing as someone",
    })
  }
})

const after = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/two-factor/enable") return // audited when verified
  const returned = ctx.context.returned
  if (!returned || isAPIError(returned)) return
  const session = ctx.context.session as Caller | null
  if (!session) return
  // Summaries carry no codes or secrets.
  await audit(
    {
      userId: session.user.id,
      email: session.user.email,
      ip: session.session.ipAddress ?? null,
      userAgent: session.session.userAgent ?? null,
    },
    ctx.path === "/two-factor/disable"
      ? {
          action: "account.two_factor_disable",
          entityType: "user",
          entityId: session.user.id,
          summary: "Turned off two-factor authentication",
        }
      : {
          action: "account.backup_codes_regenerate",
          entityType: "user",
          entityId: session.user.id,
          summary: "Generated new backup codes",
        }
  )
})

export const twoFactorPolicy = () =>
  ({
    id: "two-factor-policy",
    hooks: {
      before: [
        { matcher: ({ path = "" }) => PATHS.has(path), handler: before },
      ],
      after: [{ matcher: ({ path = "" }) => PATHS.has(path), handler: after }],
    },
  }) satisfies BetterAuthPlugin
