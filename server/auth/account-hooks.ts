import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"

import { audit, type AuditActor } from "@/server/lib/audit"

// The Account page calls Better Auth's own user endpoints from the browser
// (docs/brief.md §7.4). The server, not the client, decides what they may do
// and writes the audit log (docs/brief.md §6.6), so a crafted request gets
// the same rules and leaves the same trail.

type CallerSession = {
  user: { id: string; email: string }
  session: {
    token: string
    ipAddress?: string | null
    userAgent?: string | null
    impersonatedBy?: string | null
  }
}

const REVOKE_PATHS = new Set([
  "/revoke-session",
  "/revoke-other-sessions",
  "/revoke-sessions",
])

const SUMMARIES: Record<string, string> = {
  "/revoke-session": "Signed out of another device",
  "/revoke-other-sessions": "Signed out of all other devices",
  "/revoke-sessions": "Signed out of every device",
}

function actorOf(session: CallerSession): AuditActor {
  return {
    userId: session.user.id,
    email: session.user.email,
    // Set during View-as: the real user acting as `userId`.
    impersonatedBy: session.session.impersonatedBy ?? null,
    ip: session.session.ipAddress ?? null,
    userAgent: session.session.userAgent ?? null,
  }
}

const before = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/change-password") {
    // A changed password must end every other session: a leaked password
    // would otherwise keep working on whatever device used it.
    return {
      context: { body: { ...ctx.body, revokeOtherSessions: true } },
    }
  }

  // /revoke-session: Better Auth silently ignores a token that is not the
  // caller's. Refuse it instead, so only a real revocation is audited, and
  // keep the current session out of it (that is signing out).
  const session = (await getSessionFromCtx(ctx, {
    disableCookieCache: true,
  })) as CallerSession | null
  // No session: the endpoint refuses on its own.
  if (!session) return
  const token: unknown = ctx.body?.token
  if (typeof token !== "string") return
  if (token === session.session.token) {
    throw new APIError("BAD_REQUEST", {
      code: "CURRENT_SESSION",
      message: "Sign out to end the session on this device",
    })
  }
  const target = await ctx.context.internalAdapter.findSession(token)
  if (!target || target.session.userId !== session.user.id) {
    throw new APIError("NOT_FOUND", {
      code: "SESSION_NOT_FOUND",
      message: "That device is already signed out",
    })
  }
})

const after = createAuthMiddleware(async (ctx) => {
  const returned = ctx.context.returned
  if (returned === undefined || isAPIError(returned)) return
  // Read by the endpoint's session middleware before it ran; for a password
  // change it is the session that made the change (since rotated).
  const session = ctx.context.session as CallerSession | null
  if (!session) {
    console.error(`account-hooks: no session to audit ${ctx.path}`)
    return
  }
  if (ctx.path === "/change-password") {
    await audit(actorOf(session), {
      action: "user.password_change",
      entityType: "user",
      entityId: session.user.id,
      summary: "Changed their password and signed out other devices",
    })
    return
  }
  await audit(actorOf(session), {
    action: "session.revoke",
    // Never the token: it is a credential.
    entityType: "session",
    entityId: null,
    summary: SUMMARIES[ctx.path] ?? "Signed out of a device",
  })
})

export const accountHooks = () =>
  ({
    id: "account-hooks",
    hooks: {
      before: [
        {
          matcher: ({ path = "" }) =>
            path === "/change-password" || path === "/revoke-session",
          handler: before,
        },
      ],
      after: [
        {
          matcher: ({ path = "" }) =>
            path === "/change-password" || REVOKE_PATHS.has(path),
          handler: after,
        },
      ],
    },
  }) satisfies BetterAuthPlugin
