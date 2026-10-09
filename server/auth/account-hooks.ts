import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"
import * as z from "zod"

import { ProfileUpdate } from "@/lib/account/profile"
import { audit, type AuditActor } from "@/server/lib/audit"

// The Account page changes the password and display name through Better
// Auth's own endpoints (docs/brief.md §7.4). The server, not the client,
// decides what they may do and writes the audit log (docs/brief.md §6.6), so
// a crafted request meets the same rules and leaves the same trail. Devices
// go through server/modules/account instead (see ./hooks.ts).

type CallerSession = {
  user: { id: string; email: string; name: string }
  session: {
    ipAddress?: string | null
    userAgent?: string | null
    impersonatedBy?: string | null
  }
}

// Also held to the 2FA rule in ./hooks, like the Hono /account routes.
export const SELF_SERVICE_PATHS = new Set(["/change-password", "/update-user"])

function actorOf(session: CallerSession): AuditActor {
  return {
    userId: session.user.id,
    email: session.user.email,
    ip: session.session.ipAddress ?? null,
    userAgent: session.session.userAgent ?? null,
  }
}

const before = createAuthMiddleware(async (ctx) => {
  const session = (await getSessionFromCtx(ctx, {
    disableCookieCache: true,
  })) as CallerSession | null
  // View-as shows what a role can see; it never acts for the person.
  if (session?.session.impersonatedBy) {
    throw new APIError("FORBIDDEN", {
      code: "IMPERSONATION_READ_ONLY",
      message: "Account settings can't be changed while viewing as someone",
    })
  }

  if (ctx.path === "/change-password") {
    // A changed password must end every other session: a leaked password
    // would otherwise keep working on whatever device used it.
    return {
      context: { body: { ...ctx.body, revokeOtherSessions: true } },
    }
  }

  // /update-user would also take `image`, and any length of name.
  const parsed = ProfileUpdate.safeParse(ctx.body ?? {})
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error)
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_PROFILE",
      message: fieldErrors.name?.[0] ?? "Only your name can be changed here",
      // The form shows these under the field.
      fieldErrors,
    })
  }
  return { context: { body: parsed.data } }
})

const after = createAuthMiddleware(async (ctx) => {
  const returned = ctx.context.returned
  if (!returned || isAPIError(returned)) return

  // Read by the endpoint's session middleware before it ran: the session
  // that made the change, with the name it had before.
  const session = ctx.context.session as CallerSession | null
  if (!session) {
    console.error(`account-hooks: no session to audit ${ctx.path}`)
    return
  }

  if (ctx.path === "/change-password") {
    await audit(actorOf(session), {
      action: "account.password_change",
      entityType: "user",
      entityId: session.user.id,
      summary: "Changed their password and signed out other devices",
    })
    // The new token is dropped from the body by ./response-scrub.
    return
  }

  // /update-user, its body already validated by `before`.
  const name = (ctx.body as { name: string }).name
  if (name === session.user.name) return
  await audit(actorOf(session), {
    action: "account.profile_update",
    entityType: "user",
    entityId: session.user.id,
    summary: "Changed their display name",
    diff: { name: { from: session.user.name, to: name } },
  })
})

export const accountHooks = () =>
  ({
    id: "account-hooks",
    hooks: {
      before: [
        {
          matcher: ({ path = "" }) => SELF_SERVICE_PATHS.has(path),
          handler: before,
        },
      ],
      after: [
        {
          matcher: ({ path = "" }) => SELF_SERVICE_PATHS.has(path),
          handler: after,
        },
      ],
    },
  }) satisfies BetterAuthPlugin
